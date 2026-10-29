# Wait for one key and show it with its ZX81 character code
10 PRINT "PRESS A KEY"
20 LET K$=INKEY$
30 IF K$="" THEN GOTO 20
40 PRINT K$;" ";CODE K$
