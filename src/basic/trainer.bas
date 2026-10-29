# PROVISIONAL reconstruction: the on-screen layout is a candidate, not yet the remembered original.
# Lines 80-140 draw the multiplication as A rows of B blocks with a gap after every 5th block.
# Line 100 holds the glyph (\:: = inverse space, the full block) so it is a one-line change.
10 PRINT "PAUSE 1-9"
20 INPUT P
25 RAND
30 FOR N=1 TO 10
40 CLS
50 LET A=INT (RND*8)+2
60 LET B=INT (RND*8)+2
70 PRINT A;" X ";B
80 FOR I=1 TO A
90 FOR J=1 TO B
100 PRINT "\::";
110 IF J=5 THEN PRINT " ";
120 NEXT J
130 PRINT
140 NEXT I
150 FOR W=1 TO P*100
160 NEXT W
170 PRINT A*B
180 PAUSE 150
190 NEXT N
