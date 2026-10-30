// Reads numeric BASIC variables out of a ZX81 memory image. Pure functions: they take a function
// read(address) -> byte, so they work on the live machine, on a copy of its memory and in tests.
//
// The variables area starts at the address held in the system variable VARS (0x4010) and is a list
// of entries ended by the byte 0x80. The first byte of an entry holds a type in bits 7-5 and, for a
// one-letter name, the letter in bits 4-0 (the ZX81 character code of the letter minus 0x20):
//   010 string            name, 2-byte length, characters
//   011 number            name, 5-byte floating point value
//   100 number array      name, 2-byte length, data
//   101 number (name of several letters; the last letter has bit 7 set), 5-byte value
//   110 character array   name, 2-byte length, data
//   111 FOR loop variable name, value, limit, step (5 bytes each), 2-byte statement address
// Numbers are 5-byte floats: an exponent byte, then 4 mantissa bytes whose first byte carries the
// sign in bit 7. Value = (0.5 + fraction) * 2^(exponent - 128) with an implicit leading one.

export const VARS = 0x4010; // system variable: address of the variables area
const END_OF_VARS = 0x80;
const CODE_A = 38; // ZX81 character code of the letter A

const TYPE_STRING = 2;
const TYPE_NUMBER = 3;
const TYPE_NUMBER_ARRAY = 4;
const TYPE_LONG_NUMBER = 5;
const TYPE_CHAR_ARRAY = 6;
const TYPE_FOR = 7;

// 5-byte ZX81 floating point number at addr
export function decodeFloat(read, addr) {
  const exponent = read(addr);
  if (exponent === 0) {
    return 0;
  }
  const first = read(addr + 1);
  const fraction =
    ((first & 0x7f) * 2 ** 24 + read(addr + 2) * 2 ** 16 + read(addr + 3) * 2 ** 8 + read(addr + 4)) / 2 ** 32;
  const value = (0.5 + fraction) * 2 ** (exponent - 128);
  return first & 0x80 ? -value : value;
}

// Value of the one-letter numeric variable `letter` ("A"-"Z", also a FOR loop variable), or null
// if the program has not created it (yet).
export function readBasicNumber(read, letter) {
  const wanted = CODE_A + letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) - 0x20;
  let addr = read(VARS) | (read(VARS + 1) << 8);
  for (let entries = 0; entries < 256; entries++) {
    const first = read(addr);
    if (first === END_OF_VARS) {
      return null;
    }
    const type = first >> 5;
    if ((type === TYPE_NUMBER || type === TYPE_FOR) && (first & 0x1f) === wanted) {
      return decodeFloat(read, addr + 1);
    }
    addr += entrySize(read, addr, type);
  }
  return null; // not a variables area (e.g. memory that is not a ZX81 program)
}

function entrySize(read, addr, type) {
  switch (type) {
    case TYPE_NUMBER:
      return 1 + 5;
    case TYPE_FOR:
      return 1 + 5 + 5 + 5 + 2;
    case TYPE_STRING:
    case TYPE_NUMBER_ARRAY:
    case TYPE_CHAR_ARRAY:
      return 1 + 2 + (read(addr + 1) | (read(addr + 2) << 8));
    case TYPE_LONG_NUMBER: {
      let length = 1; // the first letter
      while (!(read(addr + length) & 0x80)) {
        length++;
      }
      return length + 1 + 5;
    }
    default:
      return 1; // unknown entry type: step over it so the scan still ends
  }
}
