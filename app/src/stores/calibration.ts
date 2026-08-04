import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  clearCalibration,
  IDENTITY_CALIBRATION,
  isCalibrationActive,
  loadCalibration,
  type PrintCalibration,
  saveCalibration,
} from '@/utils/calibration'

/** 打印校准补偿参数：全局生效，导出 PDF 与浏览器打印均自动应用 */
export const useCalibrationStore = defineStore('calibration', () => {
  const calibration = ref<PrintCalibration>(loadCalibration())

  const active = computed(() => isCalibrationActive(calibration.value))

  function apply(next: PrintCalibration) {
    calibration.value = { ...next }
    saveCalibration(calibration.value)
  }

  function reset() {
    calibration.value = { ...IDENTITY_CALIBRATION }
    clearCalibration()
  }

  return { calibration, active, apply, reset }
})
