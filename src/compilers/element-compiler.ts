import { ExprNode, Directive, ANodeProperty, ANode, ExprType } from 'san'
import { ANodeCompiler } from './anode-compiler'
import { _, TypeGuards, autoCloseTags, getANodePropByName } from 'san-ssr'
import { PHPEmitter } from '../emitters/emitter'
import { ExprCompiler } from './expr-compiler'

/**
 * 把 ANode 作为元素来编译。这个 aNode 类型是普通 DOM 元素，可能是组件根 DOM 元素，
 * 也可能是由其他 aNode 语法编译时递归到的子 DOM 元素
 */
export class ElementCompiler {
    constructor (
        private aNodeCompiler: ANodeCompiler,
        private expr: ExprCompiler,
        private emitter: PHPEmitter = new PHPEmitter()
    ) {}

    /**
     * 编译元素标签头
     *
     * @param customTagName 是否自定义标签名
     */
    tagStart (aNode: ANode) {
        const props = aNode.props
        const bindDirective = aNode.directives.bind
        const tagName = aNode.tagName
        const { emitter } = this

        if (tagName) {
            emitter.writeHTMLLiteral('<' + tagName)
        } else {
            emitter.writeHTMLLiteral('<')
            emitter.writeHTMLExpression('$tagName')
        }

        const propsIndex:any = {}
        for (const prop of props) propsIndex[prop.name] = prop
        for (const prop of props) this.compileProperty(tagName, prop, propsIndex)
        if (bindDirective) this.compileBindProperties(tagName, bindDirective)
        emitter.writeHTMLLiteral('>')
    }

    /**
     * @param customTagName 是否自定义标签名
     */
    tagEnd (aNode: ANode) {
        const { emitter } = this
        const tagName = aNode.tagName

        if (tagName) {
            if (!autoCloseTags.has(tagName)) {
                emitter.writeHTMLLiteral('</' + tagName + '>')
            }
            if (tagName === 'select') {
                emitter.writeLine('$selectValue = null;')
            }
            if (tagName === 'option') {
                emitter.writeLine('$optionValue = null;')
            }
        } else {
            emitter.writeHTMLLiteral('</')
            emitter.writeHTMLExpression('$tagName')
            emitter.writeHTMLLiteral('>')
        }
    }

    // 编译元素内容
    inner (aNode: ANode) {
        if (aNode.tagName === 'textarea') {
            const valueProp = getANodePropByName(aNode, 'value')
            if (valueProp) this.emitter.writeHTMLExpression(`_::output(${this.expr.compile(valueProp.expr)}, true)`)
            return
        }

        const htmlDirective = aNode.directives.html
        if (htmlDirective) this.emitter.writeHTMLExpression(this.expr.compile(htmlDirective.value, 'plain'))
        else for (const aNodeChild of aNode.children!) this.aNodeCompiler.compile(aNodeChild, false)
    }

    /**
     * 输出一个属性键值对
     *
     * - 如果值是字面量（布尔、字符串、数字）则在编译时 escape HTML 后输出
     * - 如果是表达式，则编译时只输出表达式，在运行时 excape HTML
     */
    private compileProperty (tagName: string, prop: ANodeProperty, propsIndex: { [key: string]: ANodeProperty }) {
        const { emitter } = this
        if (prop.name === 'slot') return
        if (prop.name === 'value') {
            if (tagName === 'textarea') return
            if (tagName === 'select') {
                const val = this.expr.compile(prop.expr)
                emitter.writeLine(`$selectValue = ${val} ? ${val} : '';`)
                return
            }
            if (tagName === 'option') {
                emitter.writeLine(`$optionValue = ${this.expr.compile(prop.expr)};`)
                // value
                emitter.writeIf('isset($optionValue)', () => {
                    emitter.writeHTMLExpression('\' value="\' . $optionValue . \'"\'')
                })
                // selected
                emitter.writeIf('$optionValue == $selectValue', () => {
                    emitter.writeHTMLLiteral(' selected')
                })
                return
            }
        }
        if (prop.name === 'readonly' || prop.name === 'disabled' || prop.name === 'multiple') {
            if (this.isLiteral(prop.expr)) {
                if (_.boolAttrFilter(prop.name, prop.expr.value)) emitter.writeHTMLLiteral(` ${prop.name}`)
            } else {
                emitter.writeHTMLExpression(`_::boolAttrFilter('${prop.name}', ${this.expr.compile(prop.expr)})`)
            }
            return
        }

        const valueProp = propsIndex.value
        const typeNode = propsIndex.type
        if (prop.name === 'checked' && tagName === 'input' && valueProp && typeNode) {
            if (typeNode.expr.value === 'checkbox') {
                emitter.writeIf(
                    `_::contains(${this.expr.compile(prop.expr)}, ${this.expr.compile(valueProp.expr)})`,
                    () => emitter.writeHTMLLiteral(' checked'))
                return
            }
            if (typeNode.expr.value === 'radio') {
                emitter.writeIf(`${this.expr.compile(prop.expr)} === ${this.expr.compile(valueProp.expr)}`, () => {
                    emitter.writeHTMLLiteral(' checked')
                })
                return
            }
        }
        const onlyOneAccessor = prop.expr.type === ExprType.ACCESSOR
        const needEscape = prop.x || onlyOneAccessor

        if (this.isLiteral(prop.expr)) {
            emitter.writeHTMLLiteral(_.attrFilter(prop.name, prop.expr.value, true))
        } else {
            emitter.writeHTMLExpression(`_::attrFilter('${prop.name}', ${this.expr.compile(prop.expr)}, ${needEscape})`)
        }
    }

    private isLiteral (expr: ExprNode) {
        return TypeGuards.isExprBoolNode(expr) || TypeGuards.isExprStringNode(expr) || TypeGuards.isExprNumberNode(expr)
    }

    private compileBindProperties (tagName: string, bindDirective: Directive<any>) {
        const { emitter } = this
        emitter.nextLine(`$bindObj = ${this.expr.compile(bindDirective.value)};`)
        emitter.writeForeach('$bindObj as $key => $value', () => {
            emitter.writeSwitch('$key', () => {
                emitter.writeCase('"readonly"')
                emitter.writeCase('"disabled"')
                emitter.writeCase('"multiple"')
                emitter.writeCase('"checked"', () => {
                    emitter.writeLine('$html .= _::boolAttrFilter($key, $value);')
                    emitter.writeBreak()
                })
                emitter.writeDefault(() => {
                    emitter.writeLine('$html .= _::attrFilter($key, $value, true);')
                })
            })
        })
    }
}
