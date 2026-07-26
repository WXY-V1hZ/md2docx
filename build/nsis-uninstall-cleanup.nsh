; NSIS 卸载清理宏 — 用于 electron-builder
; 在卸载时显示复选框，让用户选择是否删除 ~/.md2docx 中的全部数据
;
; 注意：customUnInstall 在 Section 中执行，早于自定义页面展示，
;       所以删除逻辑放在自定义页面的 Leave 回调中。

!ifdef BUILD_UNINSTALLER
  Var Checkbox_ClearData
!endif

!macro customUninstallPage
  PageEx un.custom
    PageCallbacks un.customUninstallPage_Create un.customUninstallPage_Leave
  PageExEnd

  Function un.customUninstallPage_Create
    !insertmacro MUI_HEADER_TEXT "清除用户数据" "选择是否删除预设、设置和缓存文件"
    nsDialogs::Create 1018
    Pop $0

    ${NSD_CreateCheckBox} 0 12u 100% 12u "删除 ~\.md2docx 中的全部用户数据（预设、设置、缓存）"
    Pop $Checkbox_ClearData

    nsDialogs::Show
  FunctionEnd

  Function un.customUninstallPage_Leave
    ${NSD_GetState} $Checkbox_ClearData $0
    ${If} $0 == ${BST_CHECKED}
      ReadEnvStr $1 "USERPROFILE"
      StrCpy $2 "$1\.md2docx"

      ; 多项安全检查，防止误删
      StrCmp $2 "" skip
      StrCmp $2 "\" skip
      StrLen $3 $2
      IntCmp $3 5 skip skip ; 路径至少长于 5 字符才执行

      RMDir /r $2
      skip:
    ${EndIf}
  FunctionEnd
!macroend

; customUnInstall 在 Section 中、自定义页面之前执行，
; 这里不做任何操作，删除由上方 Leave 回调处理。
!macro customUnInstall
!macroend
