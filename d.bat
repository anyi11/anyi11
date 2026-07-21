@echo off
echo 正在修复 .exe 文件关联...

:: 删除用户自定义的错误关联
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.exe\UserChoice" /f

:: 恢复系统默认关联
cmd /c assoc .exe=exefile
cmd /c ftype exefile="%%1" %%*

:: 重启资源管理器以生效
echo 正在重启资源管理器...
taskkill /f /im explorer.exe
start explorer.exe

echo 修复完成！请尝试打开任意软件。
pause
