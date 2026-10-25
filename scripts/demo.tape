# Terminal demo GIF for the README. Requires VHS (https://github.com/charmbracelet/vhs):
#   vhs scripts/demo.tape   ->   docs/img/demo.gif
Output docs/img/demo.gif
Set FontSize 16
Set Width 1100
Set Height 720
Set Theme "GitHub Dark"
Set TypingSpeed 45ms

Type "npx readyrepo openai/codex"
Sleep 400ms
Enter
Sleep 5s
Type "npx readyrepo --min-score 70 && echo 'agent-ready'"
Sleep 400ms
Enter
Sleep 4s
