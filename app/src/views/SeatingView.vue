<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import CheckboxField from '@/components/ui/CheckboxField.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import { useElementSize } from '@/composables/useElementSize'
import { useToastStore } from '@/stores/toast'
import { MM_TO_PX } from '@/utils/layout'
import { setPrintPageSize } from '@/utils/paper'
import { SEATING_HANDOFF_KEY, type SeatingHandoff } from '@/utils/seating'

const router = useRouter()
const toast = useToastStore()

// ---------- 输入 ----------
const title = ref('高三（2）班 期末考试')
const rows = ref(6)
const cols = ref(8)
const podium = ref<'top' | 'none'>('top')
const fillOrder = ref<'rows' | 'serpentine'>('rows')
/** 过道位置：第 n 列之后（1 起） */
const aisles = ref(new Set<number>())
const namesText = ref('')

const FILL_OPTIONS: SelectOption[] = [
  { value: 'rows', label: '按行填充', hint: '从讲台侧第一排，自左向右' },
  { value: 'serpentine', label: 'S 形蛇形填充', hint: '奇数排向右、偶数排向左' },
]

const names = computed(() =>
  namesText.value
    .split(/[\n,，、;；\t]+/)
    .map((s) => s.trim())
    .filter(Boolean),
)

function toggleAisle(afterCol: number) {
  const next = new Set(aisles.value)
  if (next.has(afterCol)) next.delete(afterCol)
  else next.add(afterCol)
  aisles.value = next
}

function loadDemoNames() {
  const surnames = '王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭'
  const given = '伟芳娜敏静丽强磊军洋勇艳杰娟涛明超霞平刚桂英华玉兰春香才发武新利'
  const list: string[] = []
  for (let i = 0; i < rows.value * cols.value; i++) {
    list.push(
      `${surnames[i % surnames.length]}${given[(i * 7) % given.length]}${given[(i * 13 + 5) % given.length]}`,
    )
  }
  namesText.value = list.join('\n')
  toast.info('已生成演示名单', `共 ${list.length} 人，与当前行列数一致`)
}

// ---------- 座位计算 ----------
interface Seat {
  row: number
  col: number
  seatNo: number
  name: string
}

const seats = computed<Seat[]>(() => {
  const out: Seat[] = []
  let idx = 0
  for (let r = 0; r < rows.value; r++) {
    for (let c = 0; c < cols.value; c++) {
      const col = fillOrder.value === 'serpentine' && r % 2 === 1 ? cols.value - 1 - c : c
      out.push({ row: r + 1, col: col + 1, seatNo: idx + 1, name: names.value[idx] ?? '' })
      idx++
    }
  }
  return out
})

/** 按物理行列索引取座位（渲染网格用） */
const seatGrid = computed(() => {
  const grid: (Seat | null)[][] = Array.from({ length: rows.value }, () =>
    Array.from({ length: cols.value }, () => null),
  )
  for (const seat of seats.value) grid[seat.row - 1]![seat.col - 1] = seat
  return grid
})

const seatCount = computed(() => rows.value * cols.value)
const overflowCount = computed(() => Math.max(names.value.length - seatCount.value, 0))

// ---------- A4 横向预览（mm 排版 + 缩放适配容器） ----------
const SHEET_W = 297
const SHEET_H = 210
const previewContainer = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(previewContainer)
const scale = computed(() => {
  if (!containerWidth.value) return 0.5
  return Math.min((containerWidth.value - 16) / (SHEET_W * MM_TO_PX), 1)
})

watchEffect(() => {
  if (typeof document === 'undefined') return
  setPrintPageSize(SHEET_W, SHEET_H)
})

// ---------- 打印 ----------
const renderHost = ref(false)

async function doPrint() {
  renderHost.value = true
  await nextTick()
  window.print()
  renderHost.value = false
  toast.info('已调起浏览器打印', '请选 A4 横向、无边距、缩放 100%；也可「另存为 PDF」')
}

// ---------- 一键生成对应桌贴 ----------
function toDeskLabels() {
  const filled = seats.value.filter((s) => s.name)
  if (!filled.length) {
    toast.warning('名单为空', '请先在左侧粘贴学生名单，每行一个姓名')
    return
  }
  const handoff: SeatingHandoff = {
    title: title.value,
    rows: filled.map((s) => ({
      姓名: s.name,
      座位号: String(s.seatNo),
      排: String(s.row),
      列: String(s.col),
      班级: title.value,
    })),
  }
  try {
    localStorage.setItem(SEATING_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    toast.danger('无法暂存名单', '浏览器存储不可用，请改用 Excel 上传方式')
    return
  }
  void router.push('/studio?from=seating')
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1480px] px-4 py-6 sm:py-8">
    <div class="text-center">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Seating Chart</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        教室座位表打印
      </h1>
      <p class="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        粘贴名单、设置行列与过道，生成 A4 教室平面座位表，可直接打印张贴；
        还能一键带着同一份名单去生成对应的课桌桌贴。数据全程在浏览器本地处理。
      </p>
    </div>

    <div class="mt-6 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <!-- 设置面板 -->
      <aside class="no-print flex min-w-0 flex-col gap-4">
        <section class="panel-card">
          <h2 class="section-title"><span class="step-chip">1</span>基本信息</h2>
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div class="col-span-2">
              <label class="field-label" for="seating-title">班级 / 考场标题</label>
              <input
                id="seating-title"
                v-model="title"
                type="text"
                class="input-field"
                placeholder="如：高三（2）班 期末考试"
              />
            </div>
            <div>
              <label class="field-label">排数（前后）</label>
              <NumberField v-model="rows" :min="1" :max="20" />
            </div>
            <div>
              <label class="field-label">列数（左右）</label>
              <NumberField v-model="cols" :min="1" :max="16" />
            </div>
            <div class="col-span-2">
              <label class="field-label">座位填充顺序</label>
              <SelectField v-model="fillOrder" :options="FILL_OPTIONS" />
            </div>
            <div class="col-span-2">
              <CheckboxField
                :model-value="podium === 'top'"
                class="text-xs font-semibold text-slate-600"
                label="顶部标注讲台位置"
                @update:model-value="podium = $event ? 'top' : 'none'"
              />
            </div>
          </div>
          <div class="mt-3">
            <label class="field-label">过道位置（点击列间隙切换）</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="n in Math.max(cols - 1, 0)"
                :key="n"
                type="button"
                class="rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors"
                :class="
                  aisles.has(n)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-600'
                "
                @click="toggleAisle(n)"
              >
                第 {{ n }}-{{ n + 1 }} 列间
              </button>
            </div>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <h2 class="section-title"><span class="step-chip">2</span>学生名单</h2>
            <button type="button" class="btn btn-ghost btn-sm" @click="loadDemoNames">
              用演示名单
            </button>
          </div>
          <textarea
            v-model="namesText"
            rows="10"
            class="input-field mt-2 h-auto min-h-40 resize-y py-2 leading-6"
            placeholder="每行一个姓名（也支持逗号、顿号分隔）：&#10;张伟&#10;李娜&#10;王芳……"
          ></textarea>
          <p class="mt-2 text-xs leading-5 text-slate-500">
            已输入 <strong class="text-slate-700">{{ names.length }}</strong> 人 / 座位
            <strong class="text-slate-700">{{ seatCount }}</strong> 个。
            <span v-if="overflowCount" class="font-bold text-amber-600">
              超出 {{ overflowCount }} 人排不下，请增加行列数。
            </span>
          </p>
        </section>

        <section class="panel-card">
          <h2 class="section-title"><span class="step-chip">3</span>输出</h2>
          <div class="mt-3 flex flex-col gap-2">
            <button type="button" class="btn btn-primary btn-md" @click="doPrint">
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3m-10-3h10v7H7v-7z" />
              </svg>
              打印座位表（A4 横向）
            </button>
            <button type="button" class="btn btn-secondary btn-md" @click="toDeskLabels">
              <svg
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 5h16v6H4zM4 13h7v6H4zM13 13h7v6h-7z" />
              </svg>
              一键生成对应桌贴
            </button>
            <p class="text-xs leading-5 text-slate-400">
              「生成桌贴」会把这份名单（含座位号、排、列）带入标签工坊，选模板即可批量输出课桌贴。
            </p>
          </div>
        </section>
      </aside>

      <!-- 预览 -->
      <div
        ref="previewContainer"
        class="no-print overflow-auto rounded-lg border border-slate-200/80 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] bg-slate-100/70 bg-[size:16px_16px] p-3 shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)]"
      >
        <div class="flex justify-center">
          <div
            class="relative origin-top-left"
            :style="{
              width: `${SHEET_W * MM_TO_PX * scale}px`,
              height: `${SHEET_H * MM_TO_PX * scale}px`,
            }"
          >
            <div
              class="absolute top-0 left-0 origin-top-left"
              :style="{ transform: `scale(${scale})` }"
            >
              <div class="sheet-page seating-sheet">
                <h2 class="seating-title">{{ title || '教室座位表' }}</h2>
                <div v-if="podium === 'top'" class="seating-podium">讲　台</div>
                <div class="seating-grid">
                  <div v-for="(rowSeats, r) in seatGrid" :key="r" class="seating-row">
                    <template v-for="seat in rowSeats" :key="`${r}-${seat?.col}`">
                      <div class="seating-seat" :class="{ 'seating-seat--empty': !seat?.name }">
                        <span class="seating-seat-no">{{ seat?.seatNo }}</span>
                        <span class="seating-seat-name">{{ seat?.name || '—' }}</span>
                      </div>
                      <div
                        v-if="seat && aisles.has(seat.col) && seat.col < cols"
                        class="seating-aisle"
                        aria-hidden="true"
                      ></div>
                    </template>
                  </div>
                </div>
                <p class="seating-footnote">
                  共 {{ rows }} 排 × {{ cols }} 列 · {{ names.length }} 人 · seatmark.cn 生成
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 打印宿主：teleport 到 body，打印时只输出这一页 -->
    <Teleport to="body">
      <div v-if="renderHost" class="offscreen-host">
        <div class="sheet-page seating-sheet">
          <h2 class="seating-title">{{ title || '教室座位表' }}</h2>
          <div v-if="podium === 'top'" class="seating-podium">讲　台</div>
          <div class="seating-grid">
            <div v-for="(rowSeats, r) in seatGrid" :key="r" class="seating-row">
              <template v-for="seat in rowSeats" :key="`${r}-${seat?.col}`">
                <div class="seating-seat" :class="{ 'seating-seat--empty': !seat?.name }">
                  <span class="seating-seat-no">{{ seat?.seatNo }}</span>
                  <span class="seating-seat-name">{{ seat?.name || '—' }}</span>
                </div>
                <div
                  v-if="seat && aisles.has(seat.col) && seat.col < cols"
                  class="seating-aisle"
                  aria-hidden="true"
                ></div>
              </template>
            </div>
          </div>
          <p class="seating-footnote">
            共 {{ rows }} 排 × {{ cols }} 列 · {{ names.length }} 人 · seatmark.cn 生成
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 教室座位表：A4 横向，mm 物理单位排版，打印所见即所得 */
.seating-sheet {
  width: 297mm;
  height: 210mm;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 10mm 12mm;
  background: #ffffff;
}

.seating-title {
  text-align: center;
  font-size: 7mm;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.seating-podium {
  margin: 4mm auto 0;
  width: 70mm;
  border: 0.4mm solid #334155;
  border-radius: 1.5mm;
  padding: 1.6mm 0;
  text-align: center;
  font-size: 4.2mm;
  font-weight: 700;
  letter-spacing: 1mm;
  color: #334155;
  background: #f1f5f9;
}

.seating-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  margin-top: 3mm;
  min-height: 0;
}

.seating-row {
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 2mm;
  min-height: 0;
}

.seating-seat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0.3mm solid #94a3b8;
  border-radius: 1.2mm;
  padding: 1mm 0.5mm;
  overflow: hidden;
}

.seating-seat--empty {
  border-style: dashed;
  color: #cbd5e1;
}

.seating-seat-no {
  font-size: 2.8mm;
  line-height: 1.2;
  color: #94a3b8;
  font-weight: 600;
}

.seating-seat-name {
  max-width: 100%;
  font-size: 4mm;
  line-height: 1.25;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seating-seat--empty .seating-seat-name {
  color: #cbd5e1;
}

.seating-aisle {
  width: 6mm;
  flex: none;
}

.seating-footnote {
  margin-top: 2mm;
  text-align: center;
  font-size: 2.8mm;
  color: #94a3b8;
}
</style>
