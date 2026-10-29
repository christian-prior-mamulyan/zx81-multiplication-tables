# Every ZX81 semigraphics character: codes 0-10 (normal) and 128-138 (inverse)
10 FOR N=0 TO 10
20 PRINT CHR$ N;
30 NEXT N
40 PRINT
50 FOR N=128 TO 138
60 PRINT CHR$ N;
70 NEXT N
