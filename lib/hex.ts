/**
 * @author Powered by jiangtao  template parser for hex
 * @version 0.1.0
 */
import { isUnaryTag, removeQuotes, isNotEmpty, isBoolean } from './utils'
import {
  TemplateGenertorRes,
  BaseNodeAttr,
  NodeAttr,
  builtInDirectives,
  ASTNode
} from './types'
import DIRECTIVES from './directives'

enum TYPE {
  ELEMENT = 1,
  TEXT,
  STATIC_TEXT
}

// const bindReg = /^v-bind|^:/
// const tagStateReg = /focus/
const onReg = /^@|^v-on:/
const preserveBindingReg = /(^:|^v-bind:)(style|class|type|key)/
const customPropertyReg = /(^:|^v-bind:)([\s\S]+)/

const emptyBaseNodeAttr: BaseNodeAttr = {
  name: '',
  value: ''
}

export default class TemplateGenertor {
  ast: ASTNode
  options: object
  constructor(options = {}) {
    this.options = options
  }

  generate(ast: ASTNode): TemplateGenertorRes {
    const res: TemplateGenertorRes = {
      code: ''
    }
    if (!ast) {
      return res
    }
    this.ast = ast
    res.code = this.genElement(this.ast)
    return res
  }

  genElement(node: ASTNode): string {
    if (!node) {
      return ''
    } else if (node.ifConditions && !node.ifConditionsHasGenerated) {
      return this.genIfConditions(node)
    } else if (node.type === TYPE.ELEMENT) {
      return this.genNode(node)
    } else if (node.type === TYPE.TEXT || node.type === TYPE.STATIC_TEXT) {
      return this.genText(node)
    } else {
      return ''
    }
  }

  genIfConditions(node: ASTNode): string {
    node.ifConditionsHasGenerated = true

    if (!node.ifConditions) {
      return ''
    }

    return node.ifConditions
      .map(item => {
        const { block } = item
        return this.genElement(block)
      })
      .filter(isNotEmpty)
      .join('')
  }

  genNode(node: ASTNode): string {
    const tag = this.genTag(node)
    const isUnary = isUnaryTag(tag)
    const childrenNodes = this.genChildren(node)

    const directives = [
      this.genVIf(node),
      this.genVFor(node),
      this.genVRef(node), // v-ref
      this.genVEl(node), // v-el
      this.genEvents(node),
      this.genVShow(node),
      this.genVModel(node),
      this.genVOnce(node),
      this.genVBind(node), // v-bind alias :
      this.genVCloak(node),
      this.genVHtml(node),
      this.genVPre(node),
      this.genVText(node)
    ]

    const attrs = [
      this.genAttrs(node),
      this.genStyle(node),
      this.genClass(node),
      // 特殊特性
      this.genKey(node),
      this.genRef(node),
      this.genSlot(node)
    ]

    const startTag = `<${[tag, ...directives, ...attrs]
      .filter(isNotEmpty)
      .join(' ')}${isUnary ? '/>' : '>'}`

    const endTag = isUnary ? '' : `</${tag}>`

    return [startTag, childrenNodes, endTag].join('')
  }

  genChildren(node: ASTNode): string {
    if (!node || !node.children || !node.children.length) {
      return ''
    }
    return node.children
      .map(child => this.genElement(child as ASTNode))
      .filter(isNotEmpty)
      .join('')
  }

  genTag(node: ASTNode): string {
    return node.tag
  }

  genText(node: ASTNode): string {
      let { text = '' } = node
      const id = this.options.id
      const matchReg = /\{\{\s*(\w+)\s*\}\}/g;
      const reg = /\{\{|\}\}/g
      text = text.replace(matchReg, ($0, $1) => {
          return `{{ ${$1}_${id} }}`
      })
    return text
  }
  genRef(node: ASTNode): string {
    return <string>this.getDomAttrFromAttrsMap(node, 'ref', true, true)
  }

  private transformFunctionValue(value: string): string {
      const reg = /\(.*\)$/
      const values = value.match(reg)
      if(values && values.index) {
          return `${value.substring(0, values.index)}_${this.options.id}${values[0]}`
      }
      return `${removeQuotes(value)}_${this.options.id}`
  }
  private transformValue(value: string, name?: string, type?:string): string {
      if(this.options.id) {
          if(!name) return this.transformFunctionValue(value.trim())
          let tmpValue
          switch (name) {
              case 'v-for':
                  tmpValue = removeQuotes(value).split(/\s+in\s+/g).filter(Boolean)
                  tmpValue[tmpValue.length - 1] = `${this.transformFunctionValue(tmpValue[tmpValue.length - 1].trim())}`
                  tmpValue[tmpValue.length - 1] = removeQuotes(tmpValue[tmpValue.length - 1]);
                  return `${tmpValue.join(' in ')}`
              case 'directive':
                  tmpValue = removeQuotes(value).split(':')
                  tmpValue[tmpValue.length - 1] = `${this.transformFunctionValue(tmpValue[tmpValue.length - 1].trim())}`
                  return tmpValue.join(':')
              default:
                  if(type === 'directive') {
                      tmpValue = value.split(/["']/g).filter(Boolean).pop()
                      if(tmpValue) {
                          // TODO: 处理  & | && || 等运算符
                          return this.transformFunctionValue(tmpValue.trim())
                      } else {
                          return value
                      }
                  } else {
                      return this.transformFunctionValue(removeQuotes(value).trim())
                  }

          }
      }
      return value;
  }

  genVIf(node: ASTNode): string {
    if (node.if) {
      return `${DIRECTIVES.if}=${this.transformValue(node.if)}`
    } else if (node.elseif) {
      return `${DIRECTIVES.elseif}=${this.transformValue(node.elseif)}`
    } else if (node.else) {
      return `${DIRECTIVES.else}`
    }
    return ''
  }
  genVFor(node: ASTNode): string {
      return <string>this.getDirectiveFromAttrsMap(node, 'for', true, true)
  }
  private genVv1(node: ASTNode, key: string): string {
    if(!node.directives) return ''
    const directive = node.directives.find(({name}) => name === key)
    if(directive && directive.rawName && directive.arg) {
        return <string>this.transformValue(directive.rawName, 'directive')
    }
    return ''
  }
  genVRef(node: ASTNode): string {
    return this.genVv1(node, 'ref')
  }
  genVEl(node: ASTNode): string {
    return this.genVv1(node, 'el')
  }
  genKey(node: ASTNode): string {
    return <string>this.getPropFromAttrsMap(node, 'key', true, true)
  }
  genEvents(node: ASTNode): string {
    const { attrsMap = {} } = node
    return Object.keys(attrsMap)
      .map(attr => {
        if (onReg.test(attr)) {
          return `${attr}="${this.transformValue(removeQuotes(attrsMap[attr]), 'events')}"`
        }
        return ''
      })
      .filter(isNotEmpty)
      .join(' ')
  }
  genVShow(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'show', true, true)
  }
  genVModel(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'model', true)
  }
  /**
   *
   * @param node
   * @returns return this props through v-bind or : property operator expect for style/class/type/key
   */
  genVBind(node: ASTNode): string {
    const { attrsMap = {} } = node
      const vFor = attrsMap['v-for']
    return Object.keys(attrsMap)
      .map(attr => {
        const isPreservedProperty = preserveBindingReg.test(attr)
        if (isPreservedProperty) {
          return ''
        }

        const matched = attr.match(customPropertyReg)
          if (matched) {
              const isTransformVForKey = this._isTransformVForKey(attrsMap['v-for'], attrsMap[attr], matched[0]);

              const value = isTransformVForKey ?
                  this.transformValue(removeQuotes(attrsMap[attr]), matched[0]) :
                  removeQuotes(attrsMap[attr])
          return `${matched[0]}="${value}"`
        }
        return ''
      })
      .filter(isNotEmpty)
      .join(' ')
  }
  /**
   *
   * @param node
   * @returns return the original html element attrs, like id / placeholder / focus and so on.
   */
  genAttrs(node: ASTNode): string {
    const { attrs = [], attrsMap = {} } = node
    if (!attrs.length) {
      return ''
    }
    const attrsMapKeys = Object.keys(attrsMap)
    const s =  attrs
      .map(attr => {
        const { name, value } = attr
        return attrsMapKeys.find(
          attr => `:${name}` === attr || `v-bind:${name}` === attr
        )
          ? ''
          : value === '""'
            ? `${name}`
            : `${name}="${removeQuotes(value)}"`
      })
      .filter(isNotEmpty)
      .join(' ')
    return s;
  }
  genIs(node: ASTNode): string {
    return <string>this.getPropFromAttrsMap(node, 'is', true, true)
  }
  genStyle(node: ASTNode): string {
    const bindStyle = <string>this.getPropFromAttrsMap(node, 'style', true, true)
    const staticStyle = <string>this.getDomAttrFromAttrsMap(node, 'style', true, false)
    return `${bindStyle} ${staticStyle}`
  }
  genClass(node: ASTNode): string {
    const bindClass = <string>this.getPropFromAttrsMap(node, 'class', true, true)
    const staticClass = <string>this.getDomAttrFromAttrsMap(node, 'class', true, false)
    return `${bindClass} ${staticClass}`
  }
  genVOnce(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'once', true)
  }
  genVPre(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'pre', true)
  }
  genVCloak(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'cloak', true)
  }
  genVHtml(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'html', true)
  }
  genVText(node: ASTNode): string {
    return <string>this.getDirectiveFromAttrsMap(node, 'text', true)
  }
  genSlot(node: ASTNode): string {
    if (node.tag === 'slot') {
      return <string>this.getDomAttrFromAttrsMap(node, 'name', true, false)
    }
    return ''
  }

  getDirectiveFromAttrsMap(
    node: ASTNode,
    name: builtInDirectives,
    alias?: string | boolean,
    needNormalize?: boolean
  ): string | NodeAttr {
    if (isBoolean(alias)) {
      needNormalize = <boolean>alias
    }
    let res: BaseNodeAttr | NodeAttr
    const directive = DIRECTIVES[name] || DIRECTIVES[<builtInDirectives>alias]

    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    const { attrsMap = {} } = node
    if (!directive) {
      res = emptyMap
    } else {
      const dirReg = new RegExp(directive)
      const realDir = Object.keys(attrsMap).find(attr => dirReg.test(attr))
      res = realDir
        ? attrsMap[realDir]
          ? {
              name: realDir,
              value: `"${attrsMap[realDir]}"`
            }
          : Object.assign(emptyMap, {
              noMap: true
            })
        : emptyMap
    }
    return needNormalize ? this.normalizeMap(res, 'directive', true) : res
  }

  getPropFromAttrsMap(
      node: ASTNode,
      name: string,
      needNormalize?: boolean,
      needTransform?: boolean
  ): string | NodeAttr {
    const { attrsMap = {} } = node
    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    const value =
      attrsMap[`:${name}`] || attrsMap[`${DIRECTIVES.bind}:${name}`]
    let res: BaseNodeAttr = !value
      ? emptyMap
      : { name: `:${name}`, value: `"${value}"` }
    const vFor = attrsMap['v-for']
    return needNormalize ? this.normalizeMap(res, name, needTransform, vFor) : res
  }
  getDomAttrFromAttrsMap(
      node: ASTNode,
      name: string,
      needNormalize?: boolean,
      needTransform?: boolean
  ): string | NodeAttr {
    const { attrsMap = {} } = node
    const emptyMap = Object.assign({}, emptyBaseNodeAttr)
    let res: BaseNodeAttr
    if (attrsMap.hasOwnProperty(name)) {
      res = attrsMap[name] ? { name, value: `"${attrsMap[name]}"` } : emptyMap
    } else {
      res = emptyMap
    }
    return needNormalize ? this.normalizeMap(res, name,needTransform) : res
  }
  _isTransformVForKey(vFor: string|undefined, value: string, name?: string):boolean {
    if(name === 'v-for') return true
      if(vFor) return !vFor.includes(removeQuotes(value))
      return true
  }
  normalizeMap(res: NodeAttr, type?: string, needTransform?:boolean, vFor?:string): string {
    const { name, value, noMap } = res
      if (noMap && name) {
      return name
    } else if (name && value) {
      return needTransform && this._isTransformVForKey(vFor, value, name)
          ? `${name}="${this.transformValue(removeQuotes(value), name, type)}"`
          : `${name}=${value}`
    } else {
      return ''
    }
  }
}
