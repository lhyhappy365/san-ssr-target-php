import { ElementCompiler } from '../../../src/compilers/element-compiler'
import { parseTemplate } from 'san'
import { ExprCompiler } from '../../../src/compilers/expr-compiler'
import { Stringifier } from '../../../src/compilers/stringifier'

describe('target-js/compilers/element-compiler', () => {
    let compiler
    beforeEach(() => {
        compiler = new ElementCompiler(null as any, new ExprCompiler(new Stringifier('')))
    })

    it('should compile a simple <div>', () => {
        const aNode = parseTemplate('<div></div>').children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<div></div>";
`)
    })
    it('should compile a simple <div> with customized tagName', () => {
        const aNode = parseTemplate('<div></div>')
        compiler.tagStart(aNode, true)
        compiler.tagEnd(aNode, true)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<";
$html .= $tagName;
$html .= "></";
$html .= $tagName;
$html .= ">";
`)
    })
    it('should compile input with readonly', () => {
        const aNode = parseTemplate('<div><input readonly></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual('$html .= "<input readonly>";\n')
    })
    it('should compile input with readonly value', () => {
        const aNode = parseTemplate('<div><input readonly="{{foo}}"></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<input";
$html .= _::boolAttrFilter('readonly', $ctx->data["foo"]);
$html .= ">";
`)
    })
    it('should treat checked as a normal property for non-input elements', () => {
        const aNode = parseTemplate('<div><span checked="{{foo}}"></span></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<span";
$html .= _::attrFilter('checked', $ctx->data["foo"], true);
$html .= "></span>";
`)
    })
    it('should treat checked as a normal property if type not specified', () => {
        const aNode = parseTemplate('<div><input checked="{{foo}}" value="1"></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<input";
$html .= _::attrFilter('checked', $ctx->data["foo"], true);
$html .= " value=\\"1\\">";
`)
    })
    it('should treat checked as a normal property if type not recognized', () => {
        const aNode = parseTemplate('<div><input checked="{{foo}}" value="1" type="bar"></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual(`$html .= "<input";
$html .= _::attrFilter('checked', $ctx->data["foo"], true);
$html .= " value=\\"1\\" type=\\"bar\\">";
`)
    })
    it('should compile empty textarea', () => {
        const aNode = parseTemplate('<div><textarea></textarea></div>').children[0].children[0]
        compiler.tagStart(aNode)
        compiler.inner(aNode)
        compiler.tagEnd(aNode)
        expect(compiler.emitter.fullText()).toEqual('$html .= "<textarea></textarea>";\n')
    })
})
