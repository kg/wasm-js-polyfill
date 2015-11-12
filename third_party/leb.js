'use strict';

function writeLEBUint32 (byteWriter, value) {
  var v = value;

  var b = 0;
  value |= 0;

  do {
    b = value & 0x7F;
    value >>>= 7;
    if (value)
      b |= 0x80;

    byteWriter.write(b);
  } while (value);
};

function readLEBUint32 (byteReader) {
  var result = 0, shift = 0;
  while (true) {
    var b = byteReader.read() | 0;
    var shifted = (b & 0x7F) << shift;
    result |= shifted;

    if ((b & 0x80) === 0)
      break;

    shift += 7;
  }

  result >>>= 0;
  return result;
};

function writeLEBInt32 (byteWriter, value) {
  var v = value;

  var b = 0;
  value |= 0;

  do {
    b = value & 0x7F;
    value >>= 7;

    var signBit = (b & 0x40) !== 0;

    if (
      ((value === 0) && !signBit) ||
      ((value === -1) && signBit)
    ) {
      byteWriter.write(b);
      break;
    } else {
      b |= 0x80;
      byteWriter.write(b);
    }
  } while (true);
};

function readLEBInt32 (byteReader) {
  var result = 0, shift = 0, b = 0;
  while (true) {
    b = byteReader.read() | 0;
    var shifted = (b & 0x7F) << shift;
    result |= shifted;
    shift += 7;
    
    if ((b & 0x80) === 0)
      break;
  }

  if (b & 0x40)
    result |= (-1 << shift);

  return result;
};