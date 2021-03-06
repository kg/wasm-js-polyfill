/*
   Copyright 2015 WebAssembly Community Group participants

   Licensed under the Apache License, Version 2.0 (the "License"),
   with a runtime exception;
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       https://github.com/WebAssembly/design/blob/master/LICENSE

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

///<reference path="../third_party/qunit/qunit.d.ts"/>
///<reference path="../third_party/stream.ts"/>
///<reference path="../moduleDecoder.ts"/>
///<reference path="../astDecoder.ts"/>
///<reference path="../wasm.ts"/>
///<reference path="testUtil.ts"/>

QUnit.module("moduleDecoder");

test("decodes empty module", function (assert) {
  var log = [];
  var mh = makeMockHandler<ModuleDecoder.IDecodeHandler>(log);
  var reader = makeReader([]);

  var numSections = ModuleDecoder.decodeModule(reader, mh);

  assert.equal(numSections, 0);
  assert.equal(log.length, 0);
});

test("decodes memory section", function (assert) {
  var log = [];
  var mh = makeMockHandler<ModuleDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    ModuleDecoder.Section.Memory,
    0x00, 0x00, 0x01
  ]);

  var numSections = ModuleDecoder.decodeModule(reader, mh);

  assert.equal(numSections, 1);
  assert.deepEqual(log, [
    ["onMemory", [0, 0, true]]
  ]);
});

test("decodes signature section", function (assert) {
  var log = [];
  var mh = makeMockHandler<ModuleDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    ModuleDecoder.Section.Signatures,
    0x02,
    0x00, 0x00,
    0x01, 0x02
  ]);

  var numSections = ModuleDecoder.decodeModule(reader, mh);

  assert.equal(numSections, 1);
  assert.deepEqual(log, [
    ["onSignature", [0, 0]],
    ["onSignature", [1, 2]],
  ]);
});

test("decodes function section", function (assert) {
  var log = [];
  var mh = makeMockHandler<ModuleDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    ModuleDecoder.Section.Functions,
    0x02,

    0x00, // flags
    0x00, 0x00, // signature index
    0x00, 0x00, 0x00, 0x00, // name offset
    0x00, 0x00, // body size

    0x01, 
    0x02, 0x00,
    0x03, 0x00, 0x00, 0x00,
    0x04, 0x00,
    0x00, 0x00, 0x00, 0x00, // body

    ModuleDecoder.Section.End
  ]);

  var numSections = ModuleDecoder.decodeModule(reader, mh);

  assert.equal(numSections, 2);
  assert.deepEqual(log, [
    ["onFunction", [0, 0, 0, 11, 0]],
    ["onFunction", [1, 2, 3, 20, 4]],
    ["onEndOfModule", []]
  ]);
});



QUnit.module("astDecoder");

test("decodes empty body", function (assert) {
  var log = [];
  var mh = makeMockHandler<AstDecoder.IDecodeHandler>(log);
  var reader = makeReader([]);

  var numOpcodes = AstDecoder.decodeFunctionBody(reader, mh);

  assert.equal(numOpcodes, 0);
  assert.equal(log.length, 0);
});

test("decodes argumentless opcodes", function (assert) {
  var log = [];
  var mh = makeMockHandler<AstDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    Wasm.ControlOpcode.Nop,
    Wasm.ControlOpcode.Unreachable,
    Wasm.MiscOpcode.MemorySize
  ]);

  var numOpcodes = AstDecoder.decodeFunctionBody(reader, mh);

  assert.equal(numOpcodes, 3);
  assert.deepEqual(log, [
    ["onOpcode", [ Wasm.ControlOpcode.Nop, 0, [], [] ]],
    ["onOpcode", [ Wasm.ControlOpcode.Unreachable, 0, [], [] ]],
    ["onOpcode", [ Wasm.MiscOpcode.MemorySize, 0, [], [] ]]
  ]);
});

test("immediate decoder", function (assert) {
  var log = [];
  var mh = makeMockHandler<AstDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    // Wasm.ConstantOpcode.I8Const,
    0x02,    

    // Wasm.ConstantOpcode.I32Const,
    0x04, 0x01, 0x00, 0x00,

    // todo: i64

    // Wasm.ConstantOpcode.F32Const,
    0xf3, 0x7f, 0x14, 0x42

    // todo: f64
  ]);

  assert.equal(
    AstDecoder.decodeImmediate(reader, 1, false),
    2
  );

  assert.equal(
    AstDecoder.decodeImmediate(reader, 4, false),
    260
  );

  assert.equal(
    Math.floor(AstDecoder.decodeImmediate(reader, 4, true) * 1000),
    37124
  );
});

test("decodes constant opcodes", function (assert) {
  var log = [];
  var mh = makeMockHandler<AstDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    Wasm.ConstantOpcode.I8Const,
    0x02,    

    Wasm.ConstantOpcode.I32Const,
    0x04, 0x01, 0x00, 0x00,

    // todo: i64

    Wasm.ConstantOpcode.F32Const,
    0xf3, 0x7f, 0x14, 0x42

    // todo: f64
  ]);

  var numOpcodes = AstDecoder.decodeFunctionBody(reader, mh);

  assert.equal(numOpcodes, 3);
  assert.deepEqual(log, [
    ["onOpcode", [ Wasm.ConstantOpcode.I8Const, 0, [2], [] ]],
    ["onOpcode", [ Wasm.ConstantOpcode.I32Const, 0, [260], [] ]],
    // fixme: fp precision
    ["onOpcode", [ Wasm.ConstantOpcode.F32Const, 0, [37.12495040893555], [] ]]
  ]);
});

test("decodes simple nested arithmetic", function (assert) {
  var log = [];
  var mh = makeMockHandler<AstDecoder.IDecodeHandler>(log);
  var reader = makeReader([
    Wasm.SimpleOpcode.I32Add,
    Wasm.ConstantOpcode.I8Const,
    0x03,
    Wasm.ConstantOpcode.I8Const,
    0x07
  ]);

  var numOpcodes = AstDecoder.decodeFunctionBody(reader, mh);

  assert.equal(numOpcodes, 3);
  assert.deepEqual(log, [
    ["onBeginOpcode", [ Wasm.SimpleOpcode.I32Add, [] ]],
    ["onOpcode", [ Wasm.ConstantOpcode.I8Const, 0, [0x03], [Wasm.SimpleOpcode.I32Add] ]],
    ["onOpcode", [ Wasm.ConstantOpcode.I8Const, 0, [0x07], [Wasm.SimpleOpcode.I32Add] ]],
    ["onOpcode", [ Wasm.SimpleOpcode.I32Add, 2, [], [] ]],
  ]);
});

class _Node {
  name: string;
  args: any[];
  _assert: any;

  public constructor (assert, name: string) {
    this._assert = assert;
    this.name = name;
    this.args = [];
  }

  toString () : string {
    var result = "(" + this.name;

    for (var i = 0, l = this.args.length; i < l; i++) {
      var child = this.args[i].toString();

      if ((this.args.length === 1) && (child.indexOf("(") < 0)) {
        result += " " + child;
        break;
      } else if (i === 0) {
        result += "\n";
      }

      var childLines = child.split("\n");
      for (var j = 0, l2 = childLines.length; j < l2; j++) {
        result += "  " + childLines[j] + "\n";
      }
    }

    result += ")";
    return result;
  }

  assertIs (name: string) {
    this._assert.equal(this.name, name);
  }

  assertTree (names: (string | any[])[]) {
    this._assert.equal(this.name, names[0]);

    var node = this;
    var nodeName = this.name;
    var parent = null;

    for (var i = 1, l = names.length; i < l; i++) {
      var nameOrArray = names[i];
      var next = null;

      if (typeof (nameOrArray) === "string") {
        var childName = <string>nameOrArray;
        for (var j = 0, l2 = node.args.length; j < l2; j++) {
          var child = node.args[j];
          if (child.name === childName)
            next = child;
          break;
        }

        this._assert.ok(next, "expected '" + nodeName + "' to have a child '" + childName + "'");

        if (next) {
          parent = node;
          node = next;
          nodeName = node.name;
        } else {
          return false;
        }
      } else {
        var array = <any[]>nameOrArray;
        this._assert.equal(node.args.length, array.length, "expected '" + nodeName + "' to have n children");

        for (var j = 0, l2 = array.length; j < l2; j++) {
          var child = node.args[j];

          if (child && child.assertTree)
            child.assertTree(array[j]);
          else
            this._assert.equal(child, array[j], "expected '" + nodeName + "' to have child '" + array[j] + "'");
        }

        return true;
      }
    }

    if (node.args.length !== 0)
      this._assert.ok(false, "expected '" + nodeName + "' to have no children");
  }
};

test("decodes convert.txt", function (assert) {
  var stream = [];

  var handler = {
    onBeginOpcode: function (opcode, _) {
    },
    onOpcode: function (opcode, childNodesDecoded, immediates, _) {
      var name = Wasm.OpcodeInfo.getName(opcode);
      var node = new _Node(assert, name);

      if (childNodesDecoded) {
        var childNodes = stream.slice(-childNodesDecoded);
        if (childNodes.length !== childNodesDecoded)
          throw new Error("Didn't find my children :-((((");

        stream.splice(-childNodesDecoded, childNodesDecoded);

        node.args.push.apply(node.args, childNodes);
      }

      node.args.push.apply(node.args, immediates);

      stream.push(node);
    }
  };

  var reader = makeReader([
    0xa1, 0xa7,
    0x9d, 0xa8,
    0x9f, 0xa9,
    0x9e, 0xae,
    0xa0, 0xaf,
    0x09, 0x00,
    0xa2, 0xaa,
    0xa4, 0xab,
    0xa3, 0xb0,
    0xa5, 0xb1,
    0xa6, 0x09,
    0x00, 0xac,
    0xb2, 0x0d,
    0x00, 0x00, 0x00, 0x00
  ]);

  var numOpcodes = AstDecoder.decodeFunctionBody(reader, handler);

  stream[0].assertTree(
    ["I32ConvertI64", "I64UConvertI32", "I32SConvertF32",
      "F32SConvertI32", "I32UConvertF32", "F32UConvertI32",
      "I32SConvertF64", "F64SConvertI32", "I32UConvertF64",
      "F64UConvertI32", 
      "I8Const", [0]
    ]
  );

  stream[1].assertTree(
    ["I64SConvertF32", "F32SConvertI64", "I64UConvertF32",
      "F32UConvertI64", "I64SConvertF64", "F64SConvertI64", 
      "I64UConvertF64", "F64UConvertI64", "I64SConvertI32",
      "I8Const", [0]
    ]
  );

  stream[2].assertTree(
    ["F32ConvertF64", "F64ConvertF32",
      "F32Const", [0]
    ]
  );
});