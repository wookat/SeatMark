<script setup lang="ts">
import { computed, ref } from 'vue'

import ModalDialog from '@/components/ui/ModalDialog.vue'
import NumberField from '@/components/ui/NumberField.vue'
import SelectField, { type SelectOption } from '@/components/ui/SelectField.vue'
import type { LabelPaperSpec } from '@/data/labelPapers'
import {
  buildCustomIntentContent,
  buildOrderIntentContent,
  estimateTotal,
  paperOfferFor,
} from '@/data/paperOffers'
import { API_TIMEOUT_STATUS, ApiError, apiFetch } from '@/utils/api'

const props = defineProps<{ spec: LabelPaperSpec }>()

const offer = computed(() => paperOfferFor(props.spec))

// ---------- 购买意向：材质 / 包数 / 估价 ----------
const materialKey = ref(offer.value.materials[0]!.key)
const packs = ref(1)
const materialOptions = computed<SelectOption[]>(() =>
  offer.value.materials.map((m) => ({
    value: m.key,
    label: m.surcharge > 0 ? `${m.name}（+¥${m.surcharge}/包）` : m.name,
  })),
)
const total = computed(() => estimateTotal(offer.value, packs.value, materialKey.value))

type DialogKind = 'order' | 'custom' | null
const dialog = ref<DialogKind>(null)

// ---------- 表单 ----------
const contact = ref('')
const address = ref('')
const scenario = ref('')
const fieldsWanted = ref('')
const style = ref('')
const note = ref('')
const submitting = ref(false)
const submitError = ref('')
const submitted = ref(false)

function openDialog(kind: Exclude<DialogKind, null>) {
  dialog.value = kind
  submitError.value = ''
  submitted.value = false
}

function closeDialog() {
  dialog.value = null
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === API_TIMEOUT_STATUS) return '网络超时，请稍后重试'
    if (err.status === 429) return err.message || '今日提交次数已达上限，请明天再试'
    if (err.status >= 500) return '服务暂时不可用，请稍后重试'
    return err.message || '请稍后重试'
  }
  return '网络异常，请检查网络后重试'
}

async function submit() {
  if (!contact.value.trim()) {
    submitError.value = '请留下联系方式（微信或手机号），方便客服报价确认'
    return
  }
  if (dialog.value === 'custom' && (!scenario.value.trim() || !fieldsWanted.value.trim())) {
    submitError.value = '请填写用途场景与需要的字段，客服才好按需求估价'
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    const content =
      dialog.value === 'order'
        ? buildOrderIntentContent({
            spec: props.spec,
            packs: packs.value,
            material: total.value.material,
            total: total.value.total,
            address: address.value.trim() || undefined,
            note: note.value.trim() || undefined,
          })
        : buildCustomIntentContent({
            spec: props.spec,
            scenario: scenario.value.trim(),
            fields: fieldsWanted.value.trim(),
            style: style.value.trim() || undefined,
            note: note.value.trim() || undefined,
          })
    await apiFetch('/api/feedback', {
      method: 'POST',
      body: {
        type: dialog.value === 'order' ? 'order' : 'custom',
        content,
        contact: contact.value.trim(),
        page: window.location.pathname,
      },
    })
    submitted.value = true
  } catch (err) {
    submitError.value = errorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- 购买与定制：意向单走反馈通道（KV 存档 + 企业微信实时推送），客服人工报价成交 -->
  <section class="mt-14">
    <h2 class="text-xl font-bold tracking-tight text-slate-900">购买同款纸型 / 定制模板</h2>
    <p class="mt-1.5 text-sm text-slate-600">
      参考价按主流电商口径估算，提交意向后客服报价确认（含运费与团购折扣）。
    </p>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      <!-- 购买卡片 -->
      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-900">同款不干胶纸</h3>
          <span class="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">
            意向单 · 客服报价
          </span>
        </div>
        <p class="mt-3 flex items-end gap-1.5">
          <span class="text-3xl font-bold tracking-tight text-slate-900">
            ¥{{ offer.packPrice }}
          </span>
          <span class="pb-1 text-xs font-semibold text-slate-600">
            / 包（{{ offer.sheetsPerPack }} 张，每张 {{ spec.cols * spec.rows }} 枚）
          </span>
        </p>
        <ul class="mt-2 space-y-1 text-[11px] text-slate-600">
          <li v-for="tier in offer.bulkTiers" :key="tier.minPacks">
            满 {{ tier.minPacks }} 包 ¥{{ tier.packPrice }}/包
          </li>
        </ul>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600">材质</label>
            <SelectField v-model="materialKey" :options="materialOptions" size="sm" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600">数量（包）</label>
            <NumberField v-model="packs" :min="1" :max="200" :step="1" :precision="0" />
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2.5">
          <span class="text-xs text-slate-600">
            合计约 <strong class="text-slate-900">¥{{ total.total }}</strong>
            <template v-if="total.packPrice < offer.packPrice">
              （团购价 ¥{{ total.packPrice }}/包）
            </template>
          </span>
          <button type="button" class="btn btn-primary btn-sm" @click="openDialog('order')">
            提交购买意向
          </button>
        </div>
      </div>

      <!-- 定制卡片 -->
      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-900">按此纸型定制模板</h3>
          <span class="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            人工设计
          </span>
        </div>
        <p class="mt-3 text-xs leading-5 text-slate-600">
          告诉我们用途与需要的字段（姓名、编号、条码、LOGO……），设计师按此纸型的
          {{ spec.labelWidth }}×{{ spec.labelHeight }} mm 模切格出稿，确认后进入模板库直接套打。
          会员套餐含定制额度，见<RouterLink to="/pricing" class="text-brand-600 hover:underline">定价页</RouterLink>。
        </p>
        <ul class="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
          <li class="flex items-start gap-1.5">
            <span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
            按模切格 1:1 设计，打印即对版
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
            字段与你的 Excel 表头对应，上传名单即批量出图
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-brand-500"></span>
            3 个工作日内交付初稿
          </li>
        </ul>
        <button
          type="button"
          class="btn btn-secondary btn-sm mt-4 w-full"
          @click="openDialog('custom')"
        >
          提交定制需求
        </button>
      </div>
    </div>

    <!-- 购买意向弹窗 -->
    <ModalDialog
      :open="dialog === 'order'"
      title="购买意向 · 同款不干胶纸"
      @close="closeDialog"
    >
      <div class="space-y-3.5">
        <div class="rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">
          <p class="font-semibold text-slate-900">{{ spec.name }}</p>
          <p>
            {{ spec.labelWidth }}×{{ spec.labelHeight }} mm · 每页 {{ spec.cols * spec.rows }} 枚 ·
            {{ total.material.name }} · {{ packs }} 包 · 约 ¥{{ total.total }}
          </p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            联系方式 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="contact"
            type="text"
            maxlength="200"
            placeholder="微信号或手机号，客服据此报价确认"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            收货信息 <span class="font-normal text-slate-500">（选填，可先留城市）</span>
          </label>
          <input
            v-model="address"
            type="text"
            maxlength="300"
            placeholder="省市 + 详细地址，用于估算运费与发货"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">备注</label>
          <textarea
            v-model="note"
            rows="2"
            maxlength="500"
            placeholder="数量调整、发票、发货时间等补充说明"
            class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          ></textarea>
        </div>
        <p v-if="submitError" class="text-xs text-red-600">{{ submitError }}</p>
        <p v-if="submitted" class="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          已收到购买意向，客服会尽快联系你确认价格与发货。
        </p>
      </div>
      <template #actions>
        <button type="button" class="btn btn-ghost btn-sm" @click="closeDialog">关闭</button>
        <button
          v-if="!submitted"
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交意向单' }}
        </button>
      </template>
    </ModalDialog>

    <!-- 定制需求弹窗 -->
    <ModalDialog
      :open="dialog === 'custom'"
      title="定制需求 · 按此纸型设计模板"
      @close="closeDialog"
    >
      <div class="space-y-3.5">
        <div class="rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">
          <p class="font-semibold text-slate-900">{{ spec.name }}</p>
          <p>{{ spec.labelWidth }}×{{ spec.labelHeight }} mm · 每页 {{ spec.cols * spec.rows }} 枚</p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            用途场景 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="scenario"
            type="text"
            maxlength="200"
            placeholder="例如：幼儿园防水姓名贴 / 烘焙店日期标签"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            需要的字段 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="fieldsWanted"
            type="text"
            maxlength="200"
            placeholder="例如：姓名 + 班级 + 家长电话；或品名 + 价格 + 条码"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            风格偏好 <span class="font-normal text-slate-500">（选填）</span>
          </label>
          <input
            v-model="style"
            type="text"
            maxlength="200"
            placeholder="例如：简洁黑白 / 卡通可爱 / 红色喜庆"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">
            联系方式 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="contact"
            type="text"
            maxlength="200"
            placeholder="微信号或手机号，设计师据此沟通需求"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-700">备注</label>
          <textarea
            v-model="note"
            rows="2"
            maxlength="500"
            placeholder="参考样式、交付时间、是否需要批量数据映射等"
            class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          ></textarea>
        </div>
        <p v-if="submitError" class="text-xs text-red-600">{{ submitError }}</p>
        <p v-if="submitted" class="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          已收到定制需求，客服会尽快联系你确认方案与报价。
        </p>
      </div>
      <template #actions>
        <button type="button" class="btn btn-ghost btn-sm" @click="closeDialog">关闭</button>
        <button
          v-if="!submitted"
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交定制需求' }}
        </button>
      </template>
    </ModalDialog>
  </section>
</template>
