@echo off
rem Opens Custom Kits in a window of its own (with Microsoft Edge, which comes with Windows).
start "" msedge --app="file:///%~dp0custom-kits.html" --window-size=1400,920
