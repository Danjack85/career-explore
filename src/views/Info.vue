<template>
  <div class="page">
    <h1 class="page-title">信息雷达</h1>
    <p class="page-desc">每条标来源等级，并区分「事实 / 你的判断 / 你要做的事」。</p>

    <div class="status">
      <div class="status-main">
        <span class="status-line">
          数据抓取于 {{ describeAge(snapshot.generatedAt) }}
          <span class="dot">·</span>
          {{ sourceLabel }}
        </span>
        <span v-if="snapshot.fetchedAt" class="status-sub">
          上次刷新 {{ describeAge(snapshot.fetchedAt) }}
        </span>
      </div>
      <button
        class="refresh"
        type="button"
        :disabled="refreshing"
        :title="canRefresh ? '从远程 feed 拉取最新' : '未配置远程 feed，见 docs/INFO_FEED.md'"
        @click="refresh"
      >
        {{ refreshing ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <p v-if="snapshot.error" class="warn">{{ snapshot.error }}</p>

    <p v-if="stale" class="warn">
      这批信息已经 {{ STALE_AFTER_DAYS }} 天没更新了。重新运行
      <code>node tools/fetch-info-feed.mjs</code> 抓一批新的，或配置远程 feed 自动更新。
    </p>

    <p v-if="!canRefresh" class="hint">
      当前用的是随 App 打包的数据。配置 <code>VITE_INFO_FEED_URL</code> 后，
      「刷新」就能在不重新打包的情况下拿到新内容。
    </p>

    <FilterChips v-model="activeTag" :chips="chips" group-label="按标签筛选" />

    <LoadState :loading="loading" :error="loadError" @retry="load" />

    <template v-if="!loading && !loadError">
      <template v-if="visible.length > 0">
        <article v-for="item in visible" :key="item.id" class="card info">
          <div class="info-head">
            <h2 class="info-title">{{ item.title }}</h2>
            <SourceLevelTag :level="item.source_level" />
          </div>

          <p class="info-meta">
            {{ item.source_name }} · 发布 {{ item.published_at }}
          </p>

          <section class="part">
            <span class="part-label label-fact">事实</span>
            <p class="part-text">
              {{ item.summary || '标题即来源原文，未做改写。具体数字与口径点开原文看。' }}
            </p>
          </section>

          <section class="part">
            <span class="part-label label-opinion">你的判断</span>
            <p v-if="noteOf(item).impact" class="part-text">{{ noteOf(item).impact }}</p>
            <p v-else class="part-empty">
              这条信息对你的方向意味着什么？只有你能判断。
              <button class="link-btn" type="button" @click="startEdit(item)">写下我的判断</button>
            </p>
          </section>

          <section class="part">
            <span class="part-label label-action">你要做的事</span>
            <p v-if="noteOf(item).action" class="part-text action-text">
              {{ noteOf(item).action }}
            </p>
            <p v-else class="part-empty">
              这一周你打算做什么？
              <button class="link-btn" type="button" @click="startEdit(item)">记一个动作</button>
            </p>
          </section>

          <form v-if="editingId === item.id" class="note-form" @submit.prevent="saveNoteFor(item)">
            <label class="note-field">
              <span class="note-label">对我的方向意味着什么</span>
              <textarea
                v-model="draft.impact"
                class="note-input"
                rows="2"
                placeholder="例如：制造业在扩，我做的方向偏制造，值得继续看"
              />
            </label>
            <label class="note-field">
              <span class="note-label">这一周我要做什么</span>
              <textarea
                v-model="draft.action"
                class="note-input"
                rows="2"
                placeholder="例如：这周查一下这个行业今年的招聘岗位变化"
              />
            </label>
            <div class="note-actions">
              <button class="btn-secondary" type="button" :disabled="saving" @click="cancelEdit">
                取消
              </button>
              <button class="btn-primary" type="submit" :disabled="saving">
                {{ saving ? '保存中…' : '保存' }}
              </button>
            </div>
          </form>

          <div v-else class="info-foot">
            <div class="tags">
              <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <a class="source-link" :href="item.url" target="_blank" rel="noopener noreferrer">
              查看来源
            </a>
          </div>

          <div v-if="editingId !== item.id && hasNote(item)" class="info-foot note-foot">
            <button class="link-btn" type="button" @click="startEdit(item)">修改我的批注</button>
          </div>
        </article>
      </template>

      <div v-else class="empty">
        <p class="empty-text">「{{ activeTag }}」标签下暂时没有信息。</p>
        <button class="btn-primary" type="button" @click="activeTag = null">看全部信息</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  STALE_AFTER_DAYS,
  collectFeedTags,
  describeAge,
  filterInfoByTag,
  hasRemoteFeed,
  isStale,
  listNotes,
  loadInfoSnapshot,
  refreshInfoSnapshot,
  saveNote,
} from '@/api'
import type { InfoItem, InfoNote, InfoSnapshot, NoteMap } from '@/api'
import SourceLevelTag from '@/components/SourceLevelTag.vue'
import LoadState from '@/components/LoadState.vue'
import FilterChips from '@/components/FilterChips.vue'

const emptySnapshot: InfoSnapshot = {
  items: [],
  source: 'bundled',
  generatedAt: null,
  fetchedAt: null,
  error: null,
}

const snapshot = ref<InfoSnapshot>(emptySnapshot)
const notes = ref<NoteMap>({})
const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const saving = ref(false)
const activeTag = ref<string | null>(null)
const editingId = ref<string | null>(null)
const draft = reactive({ impact: '', action: '' })

const tags = computed(() => collectFeedTags(snapshot.value.items))
const visible = computed(() => filterInfoByTag(snapshot.value.items, activeTag.value))
const stale = computed(() => isStale(snapshot.value.generatedAt))
const canRefresh = computed(() => hasRemoteFeed())

const chips = computed(() => [
  { value: null as string | null, label: '全部', count: snapshot.value.items.length },
  ...tags.value.map((tag) => ({ value: tag as string | null, label: tag })),
])

const SOURCE_LABEL: Record<InfoSnapshot['source'], string> = {
  remote: '来自远程 feed',
  cache: '来自本地缓存',
  bundled: '随 App 打包',
}

const sourceLabel = computed(() => SOURCE_LABEL[snapshot.value.source])

const noNote = (): InfoNote => ({ item_id: '', impact: '', action: '', updated_at: '' })
function noteOf(item: InfoItem): InfoNote {
  return notes.value[item.id] ?? noNote()
}
function hasNote(item: InfoItem): boolean {
  const n = noteOf(item)
  return n.impact.length > 0 || n.action.length > 0
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    snapshot.value = await loadInfoSnapshot()
    notes.value = await listNotes()
  } catch {
    loadError.value = '信息读取失败，请重试。'
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    snapshot.value = await refreshInfoSnapshot()
  } finally {
    refreshing.value = false
  }
}

function startEdit(item: InfoItem): void {
  const n = noteOf(item)
  draft.impact = n.impact
  draft.action = n.action
  editingId.value = item.id
}

function cancelEdit(): void {
  editingId.value = null
}

async function saveNoteFor(item: InfoItem): Promise<void> {
  saving.value = true
  try {
    await saveNote(item.id, { impact: draft.impact, action: draft.action })
    notes.value = await listNotes()
    editingId.value = null
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: $space-md;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
}

.status-main {
  min-width: 0;
}

.status-line {
  display: block;
  font-size: $font-size-caption;
  color: $color-text;
}

.status-sub {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: $color-text-muted;
}

.dot {
  color: $color-text-muted;
}

.refresh {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid $color-primary;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-primary;
  font-size: $font-size-caption;
  font-family: inherit;
  cursor: pointer;
}

.refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.warn {
  margin: $space-sm 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(180, 83, 9, 0.3);
  border-radius: $radius-button;
  background-color: rgba(180, 83, 9, 0.06);
  color: $color-warning;
  font-size: $font-size-caption;
}

.hint {
  margin: $space-sm 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.hint code,
.warn code {
  padding: 1px 4px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.06);
  font-size: 11px;
}

.info {
  margin-top: 12px;
}

.info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.info-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

.info-meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: $color-text-muted;
}

.part {
  margin-top: 12px;
}

.part-label {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.7;
}

.label-fact {
  background-color: $color-primary-soft;
  color: $color-primary;
}

.label-opinion {
  background-color: rgba(107, 114, 128, 0.12);
  color: $color-text-secondary;
}

.label-action {
  background-color: rgba(21, 128, 61, 0.1);
  color: $color-success;
}

.part-text {
  margin: 4px 0 0;
  font-size: $font-size-caption;
  color: $color-text;
}

.action-text {
  color: $color-success;
}

.part-empty {
  margin: 4px 0 0;
  font-size: $font-size-caption;
  color: $color-text-muted;
}

.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: $color-primary;
  font-size: $font-size-caption;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.note-form {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-surface;
}

.note-field {
  display: block;
  margin-bottom: 10px;
}

.note-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: $color-text-secondary;
}

.note-input {
  display: block;
  width: 100%;
  min-height: $control-height;
  padding: 10px 12px;
  border: 1px solid $color-border;
  border-radius: $radius-button;
  background-color: $color-bg;
  color: $color-text;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
}

.note-input:focus {
  border-color: $color-primary;
  outline: none;
}

.note-actions {
  display: flex;
  gap: 8px;
}

.note-actions .btn-secondary,
.note-actions .btn-primary {
  flex: 1;
}

.info-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid $color-border;
}

.note-foot {
  justify-content: flex-start;
  border-top: 0;
  padding-top: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: $color-surface;
  color: $color-text-secondary;
  font-size: 12px;
}

.source-link {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  // 撑到 44px 高，避免「查看来源」变成难以点中的小链接
  min-height: $control-height;
  padding-left: 12px;
  font-size: $font-size-caption;
  color: $color-primary;
  text-decoration: none;
}

.empty-text {
  margin: 0 0 12px;
}
</style>
