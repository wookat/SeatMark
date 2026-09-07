# 第 232 轮：#236（照片清除明确提示）生产复测

代码依据：workspace.ts:518-521——applyExcel 在 clearPhotos 前若 `photos.size>0` 则 toast.info「照片已清除 数据源已更换，照片需重新上传并匹配」。entry 应翻转为 `index-EbJxTvBJ.js`。夹具复用 `/home/ubuntu/r231_fixtures/`，模板 `/studio?template=withPhoto`。

## T0 部署确认
- 生产 entry == `index-EbJxTvBJ.js`（否则中止等待）。

## T1 带照片重导同一文件（核心）
- 导入 roster231 → 匹配列=姓名 → 传 张伟.jpg（覆盖率行出现）→ 再导同一文件：toasts 同时含「照片已清除\n数据源已更换，照片需重新上传并匹配」与「Excel 导入成功」；照片 img=0、覆盖率行消失。截图 toast 可见帧。

## T2 带照片切 sheet
- 重建照片态 → select 切 S2：toast 含「照片已清除」+「已切换到工作表」；照片清空。

## T3 无照片导入零打扰（负向）
- 照片已清空态（photos.size==0）再导入文件：toasts 中**不含**「照片已清除」，仅「Excel 导入成功」。

## T4 刷新提醒不回归
- 照片态刷新：400ms 轮询捕获 toast「照片需重新上传」；名单/匹配列恢复、img=0。

## T5 「清空」按钮路径
- 带照片态点「清空」：toast「数据已清空 可以重新导入新的 Excel 与照片」；（如实记录是否另出现「照片已清除」——clearData 走 clearPhotos 不经 applyExcel，预期不出现）。

## T6 照片链路冒烟回归 + 收尾
- 重导入+匹配列+张伟.jpg：toast「照片已加载 本次匹配 1 张」、卡片照片像素=红 [254,0,0]。
- 全程 pageerror=0；清 storage 关全部 tab；写 test-report.md 第 232 轮章节。P1/P2 即时上报。
