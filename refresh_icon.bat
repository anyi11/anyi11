@echo off
echo 正在清理图标缓存，请稍候...

taskkill /f /im explorer.exe

:: 清理 Windows 资源管理器图标缓存
attrib -h -r -s "%userprofile%\AppData\Local\IconCache.db"
del /f /q "%userprofile%\AppData\Local\IconCache.db"

:: 清理 Windows 10/11 缩略图与图标数据库
del /f /s /q /a "%userprofile%\AppData\Local\Microsoft\Windows\Explorer\iconcache*"
del /f /s /q /a "%userprofile%\AppData\Local\Microsoft\Windows\Explorer\thumbcache*"

start explorer.exe
echo 图标缓存刷新完成！
pause
