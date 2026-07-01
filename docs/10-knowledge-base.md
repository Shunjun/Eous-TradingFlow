# Knowledge Base 需求与实施方案

## 目标

知识库不是现有 `Datasets` 页面的一部分。它是面向 RAG、Agent Memory 和 Workflow 检索节点的独立模块，负责把用户上传的文档处理成可检索的知识索引。

第一版目标：

- 支持上传 TXT、MD、PDF、EPUB、DOCX 等文档。
- 支持创建或选择知识库后导入文档。
- 支持原文向量化、压缩后向量化、混合向量化三种处理策略。
- 支持文档分段、分片预览、手动切分和合并。
- 支持异步构建 embedding 索引，并在 Workflow 中通过节点检索。

明确约束：

- 原始上传文件和完整原文不做长期保存。
- 系统可在导入任务运行期间临时持有原始文件和解析文本。
- 导入完成后，必须保存最终参与知识库处理的文本 chunk。否则向量无法返回可读上下文，也无法给 LLM 组装 prompt。
- 可以保存原文 chunks、压缩 chunks、索引元数据和向量；不保存上传的原始文件 blob，也不保存完整未切分原文。
- Embedding 模型来自系统统一 Provider model 设置，知识库只选择已配置的 embedding 模型，不单独维护模型配置。

## 核心概念

### Overlap

`overlap` 是相邻分片之间重复保留的一段文本。

示例：

```text
chunk size = 1000 tokens
overlap = 150 tokens

chunk 1: token 0-999
chunk 2: token 850-1849
chunk 3: token 1700-2699
```

它解决的是边界信息丢失问题。例如一句关键解释正好跨在两个 chunk 之间，如果完全不重叠，检索时两个片段都可能缺上下文。缺点是会增加 embedding 成本和重复召回。

默认建议：

- 普通文档：`chunkSize = 600-1000 tokens`，`overlap = 10%-20%`。
- 结构强的 Markdown/章节文档：优先按标题分段，段内再使用较小 overlap。
- 压缩产物：通常减少 overlap，甚至可以设为 0，因为压缩文本本身应该更自洽。

### Embedding 模型更换

更换 embedding 模型后，旧向量通常不能继续用于新模型检索。

原因：

- 不同 embedding 模型的向量维度可能不同。
- 即使维度相同，向量空间也不同，相似度分数不可混用。
- 向量索引必须知道它由哪个模型生成。

设计结论：

- `embedding` 必须记录 `providerId`、`modelId`、`dimension`、`indexVersion`。
- 一个知识库可以有多个 embedding index。
- 更换默认 embedding 模型后，旧 index 标记为 `stale` 或 `inactive`。
- 用户可以继续保留旧 index，也可以触发 `rebuild index`。
- 检索时必须指定一个 active embedding index，不能跨模型混合向量搜索。

### 处理策略

知识库第一版支持三种策略：

#### `raw`

- 解析文档。
- 生成原文 chunks。
- 保存原文 chunks。
- 对原文 chunks 做 embedding。
- 检索返回原文 chunks。

#### `compressed`

- 解析文档。
- 生成原文 chunks。
- 对每个原文 chunk 生成一个压缩 chunk。
- 保存原文 chunks 和压缩 chunks。
- 对压缩 chunks 做 embedding。
- 检索返回压缩 chunks。

#### `hybrid`

- 解析文档。
- 生成原文 chunks。
- 对每个原文 chunk 生成一个压缩 chunk。
- 保存原文 chunks 和压缩 chunks。
- 只对压缩 chunks 做 embedding。
- 检索命中压缩 chunk 后，自动展开 1:1 对应的原文 chunk 作为上下文和引用来源。

`hybrid` 第一版不做双索引，也不同时 embedding 原文和压缩文本。压缩 chunk 和原文 chunk 必须保持 1:1 关系：

```ts
compressedChunk.sourceRawChunkId = rawChunk.id
rawChunk.compressedChunkId = compressedChunk.id
```

因此不提供“压缩粒度”配置，不允许多个原文 chunk 合并后压缩，也不允许压缩后再重新分片。

## 导入交互

导入流程固定为四步。

### Step 1: 来源与知识库

左侧参数：

- 上传文件。
- 选择已有知识库，或创建新的知识库。
- 选择处理策略：
  - `raw`: 原文向量化。
  - `compressed`: 压缩后向量化。
  - `hybrid`: 混合模式。
- 选择系统已配置的 embedding 模型。
- 如果选择 `compressed` 或 `hybrid`，选择系统已配置的压缩模型和压缩目标。

右侧预览：

- 文件名、大小、类型。
- 解析状态。
- 预计页数、章节数、token 数。
- 可能的风险提示，例如超大文件、扫描版 PDF、无法识别章节。

不提供“是否保留原文”选项。原始文件和完整原文只允许作为临时任务输入。

### Step 2: 切片与处理配置

本步骤把解析、原文切片、可选压缩和 embedding 输入来源放在同一个页面中配置。压缩和 embedding 在后台任务中执行，前端主要负责参数设置、原文 chunk 预览、手动切分和合并。

左侧参数：

- 解析方式：
  - 自动识别章节。
  - 按 Markdown heading。
  - 按页码。
  - 按段落。
  - 按 token 数兜底。
- 切片粒度：
  - 使用 slider 表达，不直接让用户填写 token 数。
  - 内部映射为 `minTokens`、`targetTokens`、`maxTokens`。
  - 粒度越细，越倾向句子/短段落；粒度越宽，越倾向多段落/小节/章节。
- 切分策略：
  - 自动结构切分，默认。
  - 语义增强切分，高级选项，默认关闭。
- 边界偏好：
  - 自动。
  - 标题优先。
  - 段落优先。
  - 语义优先，仅语义增强开启时可选。
- overlap：
  - 无。
  - 低。
  - 标准。
  - 高。
- 最大 chunk 数。
- 压缩设置，只有 `compressed` 和 `hybrid` 显示：
  - 压缩模型。
  - 压缩目标：摘要、要点、知识卡片、Q&A、术语表。
  - 压缩强度：轻度、标准、高压缩。
  - 保真选项：保留数字、专有名词、引用/页码、公式/代码块。
- embedding 输入来源：
  - `raw`: 原文 chunks。
  - `compressed`: 压缩 chunks。
  - `hybrid`: 压缩 chunks 负责召回，原文 chunks 负责展开上下文。
- metadata：
  - 标题路径。
  - 页码。
  - 标签。
  - 关键词。

右侧预览：

- 最终待 embedding 的分片。
- 每个 chunk 的 token 数。
- chunk 来源：原文或压缩文本。
- 手动合并。
- 手动切分。
- 搜索预览。

分片边界原则：

- 原文 chunks 是唯一可手动调整的基础边界。
- 压缩 chunks 由原文 chunks 逐个生成，保持 1:1。
- 压缩后不再重新分片。
- `compressed` 和 `hybrid` 模式下，embedding 输入都是压缩 chunks。
- `hybrid` 模式下，检索命中压缩 chunk 后展开对应原文 chunk。

手动编辑规则：

- 合并只能合并相邻原文 chunks。
- 切分只能在当前原文 chunk 内部切。
- 第一版不允许自由改写文本内容。
- 每次修改 chunk 边界后，重新估算 token 数、压缩成本和 embedding 成本。
- 如果已生成压缩预览，修改原文 chunk 边界后需要清空受影响 chunk 的压缩预览。

右侧分片工作台：

- 顶部 tabs：
  - `原文 chunks`
  - `压缩预览`
  - `最终索引`
- chunk 列表展示：
  - 标题。
  - token 数。
  - 来源章节/页码。
  - 是否超限。
  - 是否会参与 embedding。
- 操作：
  - 选中相邻 chunks 后合并。
  - 选中单个 chunk 后进入切分模式。
  - 切分模式下在文本中选择切分点，生成左右两个 chunks。
  - 点击重新计算，刷新 token、成本和预览。

### Step 3: 预览确认

本步骤确认最终会保存和索引的内容。

展示：

- 原文 chunks 数量和 token 数。
- 压缩 chunks 数量和 token 数，若有。
- embedding 输入来源。
- embedding 调用次数。
- 预计 token 数。
- 预计成本。
- 预计耗时。
- 将创建或更新的 index。
- 可能的风险提示，例如 chunk 超限、扫描版 PDF、解析结构置信度低。

### Step 4: 后台构建与结果

本步骤创建 ingestion run，并在后台执行完整处理链路：

- 解析文档。
- 生成原文 chunks。
- 执行可选压缩。
- 生成 embedding。
- 写入向量索引。

页面展示：

- 构建进度。
- 当前阶段。
- 日志。
- 错误列表。
- 失败重试。
- 取消任务。

完成后进入知识库详情页的 `Retrieval Test`。

## 章节拆分技术选择

第一版使用 LlamaIndex 作为切分引擎，但不把业务层直接绑死在 LlamaIndex API 上。后端封装 `DocumentChunkingService`，前端只传入产品语义参数：

```ts
interface DocumentChunkingService {
  preview(input: ChunkPreviewInput): Promise<ChunkPreviewResult>
  chunk(input: ChunkInput): Promise<ChunkResult>
}
```

前端配置：

```ts
strategy: 'auto_structure' | 'semantic'
granularity: number // 0-100
overlap: 'none' | 'low' | 'standard' | 'high'
boundaryPreference: 'auto' | 'heading' | 'paragraph' | 'semantic'
```

后端把这些参数映射为 LlamaIndex parser/splitter 参数。

默认策略是 `auto_structure`，不启用 embedding-based segmentation。高级选项 `semantic` 才使用 LlamaIndex `SemanticSplitterNodeParser`，通过 embedding 计算语义断点。

### 自动结构切分

自动结构切分优先使用文档结构和规则边界：

```text
章节 -> 小节 -> 段落 -> 句子 -> token 兜底
```

实现原则：

- slider 不直接等于 chunk size，而是映射为 `minTokens`、`targetTokens`、`maxTokens`。
- 在 `minTokens` 到 `maxTokens` 范围内寻找候选切点。
- 优先选择标题、小节、段落、句子等自然边界。
- 避免切开代码块、表格、列表和引用块。
- 找不到合适边界时才按 token 兜底硬切。

候选切点通过评分选择：

```text
score = lengthScore + boundaryScore + structureScore + semanticHintScore - penalty
```

第一版 `semanticHintScore` 可以只用轻量规则，例如标题变化、段落连接词、页码/章节切换；不默认调用 embedding。

### 语义增强切分

语义增强切分是高级选项，默认关闭。

开启后使用 LlamaIndex `SemanticSplitterNodeParser`，其本质是 embedding-based segmentation：

- 先把文本切成句子或短文本单元。
- 计算相邻单元或窗口的 embedding。
- 通过语义相似度下降寻找主题切换点。
- 在语义断点附近生成 chunk。

语义增强仍需要配合长度约束，避免生成过大或过小的 chunk：

- `granularity` 映射 max chunk tokens 和 breakpoint threshold。
- 越细，阈值越敏感，chunk 越短。
- 越宽，阈值越保守，chunk 越长。
- 超过最大长度必须回退到规则切分。

不同文档格式使用不同解析策略，然后统一交给 `DocumentChunkingService` 处理。

### Markdown / TXT

推荐优先使用结构化规则：

- Markdown heading：`#`、`##`、`###`。
- 空行和段落。
- 列表、代码块、表格边界。
- token 数兜底。

可选现成方案：

- LlamaIndex `SentenceSplitter`、`MarkdownNodeParser`、`HierarchicalNodeParser`。
- LlamaIndex `SemanticSplitterNodeParser`，仅用于高级语义增强切分。

### EPUB

EPUB 通常自带目录和章节文件，优先读取 TOC 和 spine。

推荐：

- 解析 EPUB 目录结构。
- 每个 chapter HTML 转为结构化文本。
- 保留章节标题路径。

可选现成方案：

- `unstructured` 的 `partition_epub`。
- Python `ebooklib` + HTML parser。

### PDF / DOCX

PDF 是最不稳定的类型，需要承认边界：

- 文字版 PDF 可以根据字体、标题、页码、目录识别章节。
- 扫描版 PDF 需要 OCR，但第一版不支持 OCR。
- 页眉页脚、双栏、脚注、表格会影响解析质量。

可选现成方案：

- `unstructured.partition` 自动识别类型并返回结构元素。
- `unstructured.partition_pdf` / `partition_docx`。
- LlamaParse 等文档解析服务。
- 兜底使用 PDF text extraction + 规则分段。

实施建议：

- 第一版优先支持 Markdown、TXT、EPUB 的较好体验。
- PDF/DOCX 先做可用解析和人工分片修正。
- 扫描版 PDF 第一版提示不支持 OCR。

## 数据模型建议

### `knowledge_bases`

- `id`
- `user_id`
- `name`
- `description`
- `active_index_id`
- `created_at`
- `updated_at`

知识库不单独保存 Provider 配置。Embedding 模型使用系统统一 Provider model 设置，具体 index 记录创建时使用的 `provider_id` 和 `model_id`。

### `knowledge_documents`

- `id`
- `knowledge_base_id`
- `title`
- `source_file_name`
- `source_mime_type`
- `source_size`
- `source_hash`
- `strategy`: `raw | compressed | hybrid`
- `status`: `uploaded | parsing | processing | indexed | failed`
- `created_at`
- `updated_at`

不保存原始文件 blob 和完整原文。

### `knowledge_ingestion_runs`

- `id`
- `knowledge_base_id`
- `document_id`
- `status`
- `strategy`
- `parse_config`
- `chunk_config`
- `compression_config`
- `embedding_config`
- `started_at`
- `finished_at`
- `error`

### `knowledge_segments`

分段是导入过程中的结构单元，主要用于解析预览和 chunk 生成。第一版可只在任务处理中临时保存，长期存储以 `knowledge_chunks` 为主。

- `id`
- `document_id`
- `run_id`
- `stage`: `parsed`
- `parent_segment_id`
- `order`
- `title`
- `section_path`
- `page_start`
- `page_end`
- `token_count`
- `content`
- `metadata`

不保存完整未切分原文。最终需要长期保存的是参与知识库检索的 chunk 文本。

### `knowledge_chunks`

保存最终可检索文本。无论 `raw`、`compressed` 还是 `hybrid`，参与索引或用于展开上下文的 chunk 文本都必须保存。

- `id`
- `document_id`
- `run_id`
- `source_raw_chunk_id`
- `order`
- `content`
- `token_count`
- `kind`: `raw | compressed`
- `embedding_role`: `indexed | context | none`
- `compressed_chunk_id`
- `metadata`

关系约束：

- `raw` 模式：只创建 `kind = raw` 的 chunks，`embedding_role = indexed`。
- `compressed` 模式：创建 raw chunks 和 compressed chunks；compressed chunk 的 `source_raw_chunk_id` 指向对应 raw chunk，`embedding_role = indexed`。
- `hybrid` 模式：创建 raw chunks 和 compressed chunks；compressed chunk `embedding_role = indexed`，raw chunk `embedding_role = context`。
- compressed chunk 和 raw chunk 必须 1:1。

### `knowledge_embedding_indexes`

- `id`
- `knowledge_base_id`
- `provider_id`
- `model_id`
- `dimension`
- `status`: `active | inactive | stale | building | failed`
- `chunk_config_hash`
- `strategy`
- `created_at`

### `knowledge_embeddings`

- `id`
- `index_id`
- `chunk_id`
- `vector`
- `metadata`
- `created_at`

## API 建议

```http
GET    /api/knowledge-bases
POST   /api/knowledge-bases
GET    /api/knowledge-bases/:id
PATCH  /api/knowledge-bases/:id
DELETE /api/knowledge-bases/:id

POST   /api/knowledge-bases/:id/documents
GET    /api/knowledge-bases/:id/documents
GET    /api/knowledge-documents/:id
DELETE /api/knowledge-documents/:id

POST   /api/knowledge-documents/:id/parse-preview
POST   /api/knowledge-documents/:id/chunk-preview
POST   /api/knowledge-documents/:id/compression-preview
POST   /api/knowledge-documents/:id/ingestion-runs
GET    /api/knowledge-ingestion-runs/:id
POST   /api/knowledge-ingestion-runs/:id/cancel

GET    /api/knowledge-documents/:id/chunks
PATCH  /api/knowledge-documents/:id/segments

POST   /api/knowledge-bases/:id/retrieve
POST   /api/knowledge-bases/:id/rebuild-index
```

## Workflow 节点

### `knowledge.retrieve`

用途：从一个或多个知识库检索相关片段。

输入：

- `knowledgeBaseIds`
- `query`
- `topK`
- `scoreThreshold`
- `retrievalMode`: `vector | hybrid`
- `maxContextTokens`
- `filters`
- `returnMode`: `chunks | contextText | citations`

输出：

- `chunks`
- `context`
- `citations`
- `scores`
- `documents`

第一版只实现 `knowledge.retrieve`。回答生成仍交给已有 `llm` 节点，这样 Workflow 更灵活。

## 前端页面

### 知识库列表页

- 知识库列表。
- 文档数。
- chunk 数。
- active embedding 模型。
- 最近索引状态。

### 知识库详情页

Tab：

- `Documents`
- `Chunks`
- `Retrieval Test`
- `Indexes`
- `Runs`
- `Settings`

### 导入向导

四步：

1. 来源与知识库。
2. 切片与处理配置。
3. 预览确认。
4. 后台构建与结果。

Step 2 使用工作台布局：

- 左侧：参数设置。
- 右侧：分片预览。
- 右侧工具：合并、切分、重算 token。

Step 2 关键交互：

- `原文 chunks` tab：展示可手动调整的基础 chunk。
- `压缩预览` tab：展示每个原文 chunk 对应的压缩结果，只有 `compressed` 和 `hybrid` 显示。
- `最终索引` tab：展示最终会参与 embedding 的 chunk。`raw` 为原文 chunks，`compressed` 和 `hybrid` 为压缩 chunks。
- 合并：多选相邻原文 chunks 后合并。
- 切分：选中单个原文 chunk，在文本中选择切分点，生成左右两个 chunks。
- 第一版不允许自由编辑文本内容。

## 需要产品敲定的问题

1. 压缩目标的第一版范围。
   - 建议先支持摘要、要点、知识卡片。
   - Q&A 和术语表可以后续补。

2. Step 2 的切片粒度 slider 档位。
   - 建议第一版提供 5 档：细、偏细、标准、偏宽、章节。
   - 内部映射到 `minTokens`、`targetTokens`、`maxTokens` 和 overlap。

3. 语义增强切分是否第一版隐藏在高级设置中。
   - 建议高级设置显示，但默认关闭。
   - 开启后需要提示会额外消耗 embedding 调用和处理时间。

4. 是否允许用户在 Step 3 修改 index 名称和是否设为 active。
   - 建议允许修改 index 名称，默认设为 active。

## 实施拆分

### Phase 1: 数据与 Provider 能力

- 确认 embedding 模型能力已在系统统一 Provider model 中配置。
- 增加知识库相关 Prisma model。
- 增加 pgvector migration。
- 增加 embedding service。
- 支持 embedding index 版本和 stale 状态。

### Phase 2: Ingestion 后端

- 文件上传临时存储。
- 文档解析 service。
- LlamaIndex adapter。
- `DocumentChunkingService`。
- 自动结构切分。
- 语义增强切分，高级选项，默认关闭。
- 压缩 service。
- chunk preview service。
- ingestion run 后台任务。
- embedding 构建任务。

### Phase 3: 前端导入向导

- Step 1 来源与知识库。
- Step 2 切片与处理配置。
- Step 3 预览确认。
- Step 4 后台构建与结果。
- 分片工作台：原文 chunks、压缩预览、最终索引。
- 手动合并和切分组件，只允许调整边界，不允许自由改写文本。

### Phase 4: 知识库管理

- 知识库列表页。
- 知识库详情页。
- 文档列表。
- chunks 查看。
- retrieval test。
- indexes 管理和 rebuild。

### Phase 5: Workflow 节点

- `knowledge.retrieve` 节点定义。
- 后端 executor。
- Workflow 变量输出。
- 与 LLM 节点串联示例模板。
