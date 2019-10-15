const HexTemplateTransform = require('../dist/hex');
const compiler = require('vue-template-compiler');
const id = '20190911';
describe('[动态控件]: 模版解析编译', () => {
  it('v-for', async () => {
    const v1Str = `<ul v-for="li in data">{{li.name}}</ul>`;

    const templateTransformer = new HexTemplateTransform({
      id
    });
    const { ast: v1Ast } = compiler.compile(v1Str);
    const code = templateTransformer.generate(v1Ast).code;
    expect(code.includes(`data_${id}`)).toBe(true);
    expect(code.includes(`li_${id}`)).toBe(false);
    expect(code.includes(`li.name_${id}`)).toBe(false);
    expect(code.includes(`li_${id}.name`)).toBe(false);
  });

  it('v-for inline directive', async () => {
    const v1Str = `<ul v-for="li in data" :class="li"></ul>`;
    const templateTransformer = new HexTemplateTransform({
      id
    });
    const { ast: v1Ast } = compiler.compile(v1Str);
    const code = templateTransformer.generate(v1Ast).code;

    expect(code.includes(`:class="li_${id}"`)).toBe(false);
    expect(code.includes(`:class="li"`)).toBe(true);
  });

  it('normal compile', async () => {
    const v1Str = `<div id="#ID#" class="hi" :class="hi"   ><img :src="src"    class="hex_img"/></div>`;
    const templateTransformer = new HexTemplateTransform({
      id
    });
    const { ast: v1Ast } = compiler.compile(v1Str);
    const code = templateTransformer.generate(v1Ast).code;
    console.log(code);
    expect(code.includes(`:src="src_${id}"`)).toBe(true);
    expect(code.includes(`:src="src"`)).toBe(false);
  });
});
