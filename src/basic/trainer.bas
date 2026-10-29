# PROVISIONAL reconstruction. The multiplication is NOT printed as numbers: the player reads it off
# the drawing (A rows of B units). Every unit is a quarter block (top-left quarter, code 1), so
# units are visibly separated, with a gap after every 5th unit across (line 110), a blank line
# after the 5th row when more rows follow (line 135), and a blank line above the printed result
# (line 165). The player's pause is in seconds: PAUSE n waits n frames and the ZX81 shows 50 per
# second, so line 150 waits P seconds. After the tenth exercise the screen is cleared and the
# program waits in lines 220-230 instead of ending: a program that ends makes the ZX81 print its
# report ("0/190": code 0 = OK, the last line run), which is not wanted on screen. The page's
# Reload button starts a new game. Plain BASIC only: no FAST/SLOW tricks; hiding the clear-screen
# wipe is the job of the page's JavaScript.
# Line 100 holds the glyph (\'  = code 1, the top-left quarter block) so it is a one-line change.
# Layout of this file: line numbers right-aligned, loop bodies indented. zxtext2p ignores the
# spaces, so the program on the ZX81 is the same.
  1 REM COPYRIGHT HORST CONSTANT ENGELHARDT, 1982
 10 PRINT "ENTER YOUR INDIVIDUAL PAUSE"
 20 INPUT P
 25 RAND
 30 FOR N=1 TO 10
 40   CLS
 50   LET A=INT (RND*8)+2
 60   LET B=INT (RND*8)+2
 80   FOR I=1 TO A
 90     FOR J=1 TO B
100       PRINT "\' ";
110       IF J=5 THEN PRINT " ";
120     NEXT J
130     PRINT
135     IF I=5 AND A>5 THEN PRINT
140   NEXT I
150   PAUSE P*50
165   PRINT
170   PRINT A*B
180   PAUSE 150
190 NEXT N
200 CLS
210 PRINT "PRESS RELOAD TO PLAY AGAIN"
220 PAUSE 32767
230 GOTO 220
