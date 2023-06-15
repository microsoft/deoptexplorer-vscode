import { Uri } from "vscode";
import { getInlineSourceMapData } from "../sourceMap";
describe("getInlineSourceMapData()", () => {
    it.each`
        uriString
        ${"data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnB1dC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG1CQUFtQjtBQUVuQixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDIn0="}
        ${"data:application/json;charset=UTF-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnB1dC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLG1CQUFtQjtBQUVuQixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDIn0="}
    `("can read '$uriString'", ({ uriString }) => {
        const uri = Uri.parse(uriString, /*strict*/ true);
        const actual = getInlineSourceMapData(uri);
        expect(actual).toBeDefined();
    });
});