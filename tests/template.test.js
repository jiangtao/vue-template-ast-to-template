const HexTemplateTransform = require('../dist/hex');
const compiler = require('vue-template-compiler');
const id = '20190911';

function genCode(str, id) {
  const templateTransformer = new HexTemplateTransform({
    id
  });
  const { ast: v1Ast } = compiler.compile(str);
  const code = templateTransformer.generate(v1Ast).code;
  return code
}
describe('[动态控件]: 模版解析编译', () => {
  it('v-for', async () => {
    const code = genCode(`<ul v-for="li in data">{{li.name}}</ul>`, id);
    expect(code.includes(`data_${id}`)).toBe(true);
    expect(code.includes(`li_${id}`)).toBe(false);
    expect(code.includes(`li.name_${id}`)).toBe(false);
    expect(code.includes(`li_${id}.name`)).toBe(false);
  });

  it('v-for inline directive', async () => {
    const code = genCode(`<ul v-for="li in data" :class="li"></ul>`, id);
    expect(code.includes(`:class="li_${id}"`)).toBe(false);
    expect(code.includes(`:class="li"`)).toBe(true);
  });

  it('normal compile', async () => {
    const code = genCode(`<div id="#ID#" class="hi" :class="hi"   ><img :src="src"    class="hex_img"/></div>`, id);
    expect(code.includes(`:src="src_${id}"`)).toBe(true);
    expect(code.includes(`:src="src"`)).toBe(false);
  });

  it('anchor case', async () => {
    const code = genCode(`<a :href="href" :target="target" id="#ID#">{{name}}</a>`, id)
    expect(code.includes(`name_${id}`)).toBe(true);
  })

  it('component iview1 code', async () => {
    const code = genCode(`
      <Radio v-for="li in list" :value.sync="li" @click="click(li)"></Radio>
    `, id)
    expect(code.includes(`click_${id}(li)`)).toBe(true);
    expect(code.includes(`li in list_${id}`)).toBe(true);
  })

  it('support #hex#', async () => {
    const code = genCode(`
      <div $click$>$children$</div>
    `, id)
    expect(code.includes(`$children$`)).toBe(true);
  })
});
