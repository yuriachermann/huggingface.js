import { beforeAll, describe, expect, it } from "vitest";
import type { GGUFParseOutput, MetadataValue } from "./gguf";
import {
	GGMLFileQuantizationType,
	GGMLQuantizationType,
	GGUFValueType,
	gguf,
	ggufAllShards,
	parseGgufShardFilename,
	parseGGUFQuantLabel,
	GGUF_QUANT_ORDER,
	findNearestQuantType,
} from "./gguf";
import fs from "node:fs";

const URL_LLAMA = "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/191239b/llama-2-7b-chat.Q2_K.gguf";
const URL_MISTRAL_7B =
	"https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/3a6fbf4/mistral-7b-instruct-v0.2.Q5_K_M.gguf";
const URL_GEMMA_2B = "https://huggingface.co/lmstudio-ai/gemma-2b-it-GGUF/resolve/a0b140b/gemma-2b-it-q4_k_m.gguf";
const URL_BIG_ENDIAN =
	"https://huggingface.co/ggml-org/models/resolve/1213976/bert-bge-small/ggml-model-f16-big-endian.gguf";
const URL_V1 =
	"https://huggingface.co/tmadge/testing/resolve/66c078028d1ff92d7a9264a1590bc61ba6437933/tinyllamas-stories-260k-f32.gguf";
const URL_SHARDED_GROK =
	"https://huggingface.co/Arki05/Grok-1-GGUF/resolve/ecafa8d8eca9b8cd75d11a0d08d3a6199dc5a068/grok-1-IQ3_XS-split-00001-of-00009.gguf";
const URL_BIG_METADATA = "https://huggingface.co/ngxson/test_gguf_models/resolve/main/gguf_test_big_metadata.gguf";

describe("gguf", () => {
	beforeAll(async () => {
		// download the gguf for "load file" test, save to .cache directory
		if (!fs.existsSync(".cache")) {
			fs.mkdirSync(".cache");
		}
		if (!fs.existsSync(".cache/model.gguf")) {
			const res = await fetch(URL_BIG_METADATA);
			const arrayBuf = await res.arrayBuffer();
			fs.writeFileSync(".cache/model.gguf", Buffer.from(arrayBuf));
		}
	}, 30_000);

	it("should parse a llama2 7b", async () => {
		const { metadata, tensorInfos } = await gguf(URL_LLAMA);

		/// metadata

		expect(metadata).toMatchObject({
			// partial list, do not exhaustively list (tokenizer is quite big for instance)
			version: 2,
			tensor_count: 291n,
			kv_count: 19n,
			"general.architecture": "llama",
			"general.file_type": GGMLFileQuantizationType.Q2_K,
			"general.name": "LLaMA v2",
			"general.quantization_version": 2,
			"llama.attention.head_count": 32,
			"llama.attention.head_count_kv": 32,
			"llama.attention.layer_norm_rms_epsilon": 9.999999974752427e-7,
			"llama.block_count": 32,
			"llama.context_length": 4096,
			"llama.embedding_length": 4096,
			"llama.feed_forward_length": 11008,
			"llama.rope.dimension_count": 128,
		});

		expect(metadata["tokenizer.ggml.model"]);
		if (metadata["tokenizer.ggml.model"]) {
			const tokens = metadata["tokenizer.ggml.tokens"];
			if (!Array.isArray(tokens)) {
				throw new Error();
			}
			expect(tokens.slice(0, 10)).toEqual([
				"<unk>",
				"<s>",
				"</s>",
				"<0x00>",
				"<0x01>",
				"<0x02>",
				"<0x03>",
				"<0x04>",
				"<0x05>",
				"<0x06>",
			]);
		}

		/// Tensor infos
		/// By convention we test the first and last tensor.

		expect(tensorInfos.length).toEqual(291);
		expect(tensorInfos[0]).toMatchObject({
			name: "token_embd.weight",
			shape: [4096n, 32000n],
			dtype: GGMLQuantizationType.Q2_K,
		});
		expect(tensorInfos[tensorInfos.length - 1]).toMatchObject({
			name: "output_norm.weight",
			shape: [4096n],
			dtype: GGMLQuantizationType.F32,
		});
	});

	it("should parse a mistral 7b", async () => {
		const { metadata, tensorInfos } = await gguf(URL_MISTRAL_7B);

		/// metadata

		expect(metadata).toMatchObject({
			version: 3,
			tensor_count: 291n,
			kv_count: 24n,
			"general.architecture": "llama",
			"general.file_type": GGMLFileQuantizationType.Q5_K_M,
			"general.name": "mistralai_mistral-7b-instruct-v0.2",
			"general.quantization_version": 2,
			"llama.attention.head_count": 32,
			"llama.attention.head_count_kv": 8,
			"llama.attention.layer_norm_rms_epsilon": 0.000009999999747378752,
			"llama.block_count": 32,
			"llama.context_length": 32768,
			"llama.embedding_length": 4096,
			"llama.feed_forward_length": 14336,
			"llama.rope.dimension_count": 128,
		});

		/// Tensor infos

		expect(tensorInfos.length).toEqual(291);
		expect(tensorInfos[0]).toMatchObject({
			name: "token_embd.weight",
			shape: [4096n, 32000n],
			dtype: GGMLQuantizationType.Q5_K,
		});
		expect(tensorInfos[tensorInfos.length - 1]).toMatchObject({
			name: "output.weight",
			shape: [4096n, 32000n],
			dtype: GGMLQuantizationType.Q6_K,
		});
	});

	it("should parse a gemma 2b", async () => {
		const { metadata, tensorInfos } = await gguf(URL_GEMMA_2B);

		/// metadata

		expect(metadata).toMatchObject({
			version: 3,
			tensor_count: 164n,
			kv_count: 21n,
			"general.architecture": "gemma",
			"general.file_type": GGMLFileQuantizationType.Q4_K_M,
			"general.name": "gemma-2b-it",
			"general.quantization_version": 2,
			"gemma.attention.head_count": 8,
			"gemma.attention.head_count_kv": 1,
			"gemma.attention.layer_norm_rms_epsilon": 9.999999974752427e-7,
			"gemma.block_count": 18,
			"gemma.context_length": 8192,
			"gemma.embedding_length": 2048,
			"gemma.feed_forward_length": 16384,
		});

		/// Tensor infos

		expect(tensorInfos.length).toEqual(164);
		expect(tensorInfos[0]).toMatchObject({
			name: "token_embd.weight",
			shape: [2048n, 256128n],
			dtype: GGMLQuantizationType.Q4_K,
		});
		expect(tensorInfos[tensorInfos.length - 1]).toMatchObject({
			name: "blk.9.ffn_norm.weight",
			shape: [2048n],
			dtype: GGMLQuantizationType.F32,
		});
	});

	it("should parse a big-endian file", async () => {
		const { metadata, tensorInfos } = await gguf(URL_BIG_ENDIAN);

		/// metadata

		expect(metadata).toMatchObject({
			version: 3,
			tensor_count: 197n,
			kv_count: 23n,
			"general.architecture": "bert",
			"general.file_type": GGMLFileQuantizationType.F16,
			"general.name": "bge-small-en-v1.5",
			"bert.attention.causal": false,
			"bert.attention.head_count": 12,
			"bert.attention.layer_norm_epsilon": 9.999999960041972e-13,
			"bert.block_count": 12,
			"bert.context_length": 512,
			"bert.embedding_length": 384,
			"bert.feed_forward_length": 1536,
			"bert.pooling_type": 2,
		});

		/// Tensor infos

		expect(tensorInfos.length).toEqual(197);
		expect(tensorInfos[0]).toMatchObject({
			name: "token_embd_norm.bias",
			shape: [384n],
			dtype: GGMLQuantizationType.F32,
		});
		expect(tensorInfos[tensorInfos.length - 1]).toMatchObject({
			name: "blk.9.ffn_down.weight",
			shape: [1536n, 384n],
			dtype: GGMLQuantizationType.F16,
		});
	});

	it("should parse a v1 file", async () => {
		const { metadata, tensorInfos } = await gguf(URL_V1);

		/// metadata

		expect(metadata).toMatchObject({
			version: 1,
			tensor_count: 48n,
			kv_count: 18n,
			"general.architecture": "llama",
			"general.name": "tinyllamas-stories-260k",
			"llama.attention.head_count": 8,
			"llama.attention.head_count_kv": 4,
			"llama.attention.layer_norm_rms_epsilon": 0.000009999999747378752,
			"llama.block_count": 5,
			"llama.context_length": 512,
			"llama.embedding_length": 64,
			"llama.feed_forward_length": 172,
			"llama.rope.dimension_count": 8,
			"llama.tensor_data_layout": "Meta AI original pth",
			"tokenizer.ggml.bos_token_id": 1,
			"tokenizer.ggml.eos_token_id": 2,
			"tokenizer.ggml.model": "llama",
			"tokenizer.ggml.padding_token_id": 0,
		});

		/// Tensor infos

		expect(tensorInfos.length).toEqual(48);
		expect(tensorInfos[0]).toMatchObject({
			name: "token_embd.weight",
			shape: [64n, 512n],
			dtype: GGMLQuantizationType.F32,
		});
		expect(tensorInfos[tensorInfos.length - 1]).toMatchObject({
			name: "output.weight",
			shape: [64n, 512n],
			dtype: GGMLQuantizationType.F32,
		});
	});

	it("should parse a local file", async () => {
		const parsedGguf = await gguf(".cache/model.gguf", { allowLocalFile: true });
		const { metadata } = parsedGguf as GGUFParseOutput<{ strict: false }>; // custom metadata arch, no need for typing
		expect(metadata["dummy.1"]).toBeDefined(); // first metadata in the list
		expect(metadata["dummy.32767"]).toBeDefined(); // last metadata in the list
	});

	it("should detect sharded gguf filename", async () => {
		const ggufPath = "grok-1/grok-1-q4_0-00003-of-00009.gguf"; // https://huggingface.co/ggml-org/models/blob/fcf344adb9686474c70e74dd5e55465e9e6176ef/grok-1/grok-1-q4_0-00003-of-00009.gguf
		const ggufShardFileInfo = parseGgufShardFilename(ggufPath);

		expect(ggufShardFileInfo?.prefix).toEqual("grok-1/grok-1-q4_0");
		expect(ggufShardFileInfo?.shard).toEqual("00003");
		expect(ggufShardFileInfo?.total).toEqual("00009");
	});

	it("should get param count for llama2 7b", async () => {
		const { parameterCount } = await gguf(URL_LLAMA, { computeParametersCount: true });
		expect(parameterCount).toEqual(6_738_415_616); // 7B
	});

	it("should get param count for sharded gguf", async () => {
		const { parameterCount } = await ggufAllShards(URL_SHARDED_GROK);
		expect(parameterCount).toEqual(316_490_127_360); // 316B
	});

	it("parse quant label", async () => {
		expect(parseGGUFQuantLabel("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")).toEqual("Q4_K_M");
		expect(parseGGUFQuantLabel("subdir/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")).toEqual("Q4_K_M");
		expect(parseGGUFQuantLabel("Codestral-22B-v0.1-Q2_K.gguf")).toEqual("Q2_K");
		expect(parseGGUFQuantLabel("Codestral-22B-v0.1.gguf")).toEqual(undefined);
		expect(parseGGUFQuantLabel("Codestral-22B-v0.1-F32-Q2_K.gguf")).toEqual("Q2_K"); // gguf name with two quant labels [F32, Q2_K]
		expect(parseGGUFQuantLabel("Codestral-22B-v0.1-IQ3_XS.gguf")).toEqual("IQ3_XS");
		expect(parseGGUFQuantLabel("Codestral-22B-v0.1-Q4_0_4_4.gguf")).toEqual("Q4_0"); // TODO: investigate Q4_0_4_4
	});

	it("calculate tensor data offset", async () => {
		const { tensorDataOffset } = await gguf(URL_LLAMA);
		expect(tensorDataOffset).toEqual(741056n);
	});

	// Quantization handler

	it("should have GGUF_QUANT_ORDER in sync with GGMLQuantizationType enum", () => {
		const enumValues = Object.values(GGMLQuantizationType).filter((value) => typeof value === "number") as number[];
		const checkValues = new Set(GGUF_QUANT_ORDER);
		for (const value of enumValues) {
			expect(checkValues).toContain(value);
		}
	});

	it("should find the nearest quant", () => {
		const quant = GGMLFileQuantizationType.IQ2_M;
		const availableQuants = [
			GGMLFileQuantizationType.Q2_K,
			GGMLFileQuantizationType.Q4_K_M,
			GGMLFileQuantizationType.Q8_0,
		];
		const nearestQuant = findNearestQuantType(quant, availableQuants);
		expect(nearestQuant).toEqual(GGMLFileQuantizationType.Q2_K);
	});

	it("should find the nearest quant (vision model)", () => {
		const visionQuants = [GGMLFileQuantizationType.Q8_0, GGMLFileQuantizationType.F16, GGMLFileQuantizationType.BF16];
		let nearestQuant;
		// text = Q4_K_M
		nearestQuant = findNearestQuantType(GGMLFileQuantizationType.Q4_K_M, visionQuants);
		expect(nearestQuant).toEqual(GGMLFileQuantizationType.Q8_0);
		// text = Q8_0
		nearestQuant = findNearestQuantType(GGMLFileQuantizationType.Q8_0, visionQuants);
		expect(nearestQuant).toEqual(GGMLFileQuantizationType.Q8_0);
		// text = F16
		nearestQuant = findNearestQuantType(GGMLFileQuantizationType.F16, visionQuants);
		expect(nearestQuant).toEqual(GGMLFileQuantizationType.F16);
	});

	it("should not return typedMetadata by default", async () => {
		const result = await gguf(URL_LLAMA);
		expect(result).not.toHaveProperty("typedMetadata");
		expect(result).toHaveProperty("metadata");
		expect(result).toHaveProperty("tensorInfos");
		expect(result).toHaveProperty("tensorDataOffset");
	});

	it("should return typedMetadata when requested", async () => {
		const { metadata, typedMetadata, tensorInfos } = await gguf(URL_LLAMA, { typedMetadata: true });

		// Should have both metadata and typedMetadata
		expect(metadata).toBeDefined();
		expect(typedMetadata).toBeDefined();
		expect(tensorInfos).toBeDefined();

		// Basic structure checks
		expect(typedMetadata.version).toEqual({
			value: 2,
			type: GGUFValueType.UINT32,
		});
		expect(typedMetadata.tensor_count).toEqual({
			value: 291n,
			type: GGUFValueType.UINT64,
		});
		expect(typedMetadata.kv_count).toEqual({
			value: 19n,
			type: GGUFValueType.UINT64,
		});

		// Check string metadata
		expect(typedMetadata["general.architecture"]).toEqual({
			value: "llama",
			type: GGUFValueType.STRING,
		});
		expect(typedMetadata["general.name"]).toEqual({
			value: "LLaMA v2",
			type: GGUFValueType.STRING,
		});

		// Check numeric metadata
		expect(typedMetadata["general.file_type"]).toEqual({
			value: GGMLFileQuantizationType.Q2_K,
			type: GGUFValueType.UINT32,
		});
		expect(typedMetadata["llama.attention.head_count"]).toEqual({
			value: 32,
			type: GGUFValueType.UINT32,
		});

		// Check float metadata
		expect(typedMetadata["llama.attention.layer_norm_rms_epsilon"]).toEqual({
			value: 9.999999974752427e-7,
			type: GGUFValueType.FLOAT32,
		});
	});

	it("should return typedMetadata with parameter count", async () => {
		const { metadata, typedMetadata, tensorInfos, parameterCount } = await gguf(URL_LLAMA, {
			typedMetadata: true,
			computeParametersCount: true,
		});

		expect(metadata).toBeDefined();
		expect(typedMetadata).toBeDefined();
		expect(tensorInfos).toBeDefined();
		expect(parameterCount).toEqual(6_738_415_616);

		// Verify typedMetadata structure is still correct
		expect(typedMetadata.version).toEqual({
			value: 2,
			type: GGUFValueType.UINT32,
		});
		expect(typedMetadata["general.architecture"]).toEqual({
			value: "llama",
			type: GGUFValueType.STRING,
		});
	});

	it("should handle typedMetadata for V1 files", async () => {
		const { typedMetadata } = await gguf(URL_V1, { typedMetadata: true });

		// V1 files use UINT32 for counts instead of UINT64
		expect(typedMetadata.version).toEqual({
			value: 1,
			type: GGUFValueType.UINT32,
		});
		expect(typedMetadata.tensor_count).toEqual({
			value: 48n,
			type: GGUFValueType.UINT32,
		});
		expect(typedMetadata.kv_count).toEqual({
			value: 18n,
			type: GGUFValueType.UINT32,
		});

		// Check other fields are properly typed
		expect(typedMetadata["general.architecture"]).toEqual({
			value: "llama",
			type: GGUFValueType.STRING,
		});
		expect(typedMetadata["llama.attention.head_count"]).toEqual({
			value: 8,
			type: GGUFValueType.UINT32,
		});
	});

	it("should handle array metadata types in typedMetadata", async () => {
		const { typedMetadata } = await gguf(URL_LLAMA, { typedMetadata: true });

		// Check if tokens array is properly handled
		if (typedMetadata["tokenizer.ggml.tokens"]) {
			expect(typedMetadata["tokenizer.ggml.tokens"].type).toEqual(GGUFValueType.ARRAY);
			expect(typedMetadata["tokenizer.ggml.tokens"].subType).toEqual(GGUFValueType.STRING);
			expect(Array.isArray(typedMetadata["tokenizer.ggml.tokens"].value)).toBe(true);
		}

		// Check if scores array is properly handled
		if (typedMetadata["tokenizer.ggml.scores"]) {
			expect(typedMetadata["tokenizer.ggml.scores"].type).toEqual(GGUFValueType.ARRAY);
			expect(typedMetadata["tokenizer.ggml.scores"].subType).toEqual(GGUFValueType.FLOAT32);
			expect(Array.isArray(typedMetadata["tokenizer.ggml.scores"].value)).toBe(true);
		}

		// Check if token_type array is properly handled
		if (typedMetadata["tokenizer.ggml.token_type"]) {
			expect(typedMetadata["tokenizer.ggml.token_type"].type).toEqual(GGUFValueType.ARRAY);
			expect(typedMetadata["tokenizer.ggml.token_type"].subType).toEqual(GGUFValueType.INT32);
			expect(Array.isArray(typedMetadata["tokenizer.ggml.token_type"].value)).toBe(true);
		}
	});

	it("should maintain consistency between metadata and typedMetadata values", async () => {
		const { metadata, typedMetadata } = await gguf(URL_LLAMA, { typedMetadata: true });

		// All keys should be present in both
		const metadataKeys = Object.keys(metadata);
		const typedMetadataKeys = Object.keys(typedMetadata);

		expect(metadataKeys.sort()).toEqual(typedMetadataKeys.sort());

		// Values should match for all keys
		const metadataAsRecord = metadata as Record<string, MetadataValue>;
		for (const key of metadataKeys) {
			expect(typedMetadata[key].value).toEqual(metadataAsRecord[key]);
		}
	});
});
