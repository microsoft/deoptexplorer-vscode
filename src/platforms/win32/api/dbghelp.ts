// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// TODO: Most of this isn't working anymore in the latest VS Code because `ref-napi` and `ffi-napi` haven't been
//       updated to support newer versions of electron.

import { tryExec } from "#core/utils.js";
import { randomBytes } from "crypto";
import * as ffi from "ffi-napi";
import * as ref from "ref-napi";
import { Uri } from "vscode";
import { ArrayType } from "./ref-array";
import { StructType } from "./ref-struct";
import { BOOL, CHAR, DWORD, DWORD64, GUID, HANDLE, INT, PCSTR, PCWSTR, PDWORD, PDWORD64, PSTR, PVOID, PWSTR, ULONG, ULONG64, WCHAR } from "./win32";

export enum SYM_TYPE {
    SymNone = 0,
    SymCoff,
    SymCv,
    SymPdb,
    SymExport,
    SymDeferred,
    SymSym,
    SymDia,
    SymVirtual,
    NumSymTypes
}

export namespace SYM_TYPE {
    export const size = INT.size;
    export const alignment = INT.alignment;
    export const indirection = 1;
    export function get(buffer: Buffer, offset: number) {
        return INT.get(buffer, offset) as SYM_TYPE;
    }
    export function set(buffer: Buffer, offset: number, value: SYM_TYPE) {
        return INT.set(buffer, offset, value);
    }
}

Object.setPrototypeOf(SYM_TYPE, INT);

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-imagehlp_module64
// typedef struct _IMAGEHLP_MODULE64 {
//   DWORD    SizeOfStruct;           // set to sizeof(IMAGEHLP_MODULE64)
//   DWORD64  BaseOfImage;            // base load address of module
//   DWORD    ImageSize;              // virtual size of the loaded module
//   DWORD    TimeDateStamp;          // date/time stamp from pe header
//   DWORD    CheckSum;               // checksum from the pe header
//   DWORD    NumSyms;                // number of symbols in the symbol table
//   SYM_TYPE SymType;                // type of symbols loaded
//   CHAR     ModuleName[32];         // module name
//   CHAR     ImageName[256];         // image name
//   CHAR     LoadedImageName[256];   // symbol file name
//   // new elements: 07-Jun-2002
//   CHAR     LoadedPdbName[256];     // pdb file name
//   DWORD    CVSig;                  // Signature of the CV record in the debug directories
//   CHAR     CVData[MAX_PATH * 3];   // Contents of the CV record
//   DWORD    PdbSig;                 // Signature of PDB
//   GUID     PdbSig70;               // Signature of PDB (VC 7 and up)
//   DWORD    PdbAge;                 // DBI age of pdb
//   BOOL     PdbUnmatched;           // loaded an unmatched pdb
//   BOOL     DbgUnmatched;           // loaded an unmatched dbg
//   BOOL     LineNumbers;            // we have line number information
//   BOOL     GlobalSymbols;          // we have internal symbol information
//   BOOL     TypeInfo;               // we have type information
//   // new elements: 17-Dec-2003
//   BOOL     SourceIndexed;          // pdb supports source server
//   BOOL     Publics;                // contains public symbols
//   // new element: 15-Jul-2009
//   DWORD    MachineType;            // IMAGE_FILE_MACHINE_XXX from ntimage.h and winnt.h
//   DWORD    Reserved;               // Padding - don't remove.
// } IMAGEHLP_MODULE64, *PIMAGEHLP_MODULE64;
export const IMAGEHLP_MODULE64 = StructType({
    SizeOfStruct:       DWORD,                      // must be set to sizeof(IMAGEHLP_MODULE64)
    BaseOfImage:        DWORD64,
    ImageSize:          DWORD,
    TimeDateStamp:      DWORD,
    CheckSum:           DWORD,
    NumSyms:            DWORD,
    SymType:            SYM_TYPE,
    ModuleName:         ArrayType(CHAR, 32),        // 32-bytes, null-terminated
    ImageName:          ArrayType(CHAR, 256),       // 256-bytes, null-terminated
    LoadedImageName:    ArrayType(CHAR, 256),       // 256-bytes, null-terminated
    LoadedPdbName:      ArrayType(CHAR, 256),       // 256-bytes, null-terminated
    CVSig:              DWORD,
    CVData:             ArrayType(CHAR, 260 * 3),
    PdbSig:             DWORD,
    PdbSig70:           GUID,
    PdbAge:             DWORD,
    PdbUnmatched:       BOOL,
    DbgUnmatched:       BOOL,
    LineNumbers:        BOOL,
    GlobalSymbols:      BOOL,
    TypeInfo:           BOOL,
    SourceIndexed:      BOOL,
    Publics:            BOOL,
    MachineType:        DWORD,
    Reserved:           DWORD,
});
export type IMAGEHLP_MODULE64 = ref.UnderlyingType<typeof IMAGEHLP_MODULE64>;

export const PIMAGEHLP_MODULE64 = ref.refType(IMAGEHLP_MODULE64);
export type PIMAGEHLP_MODULE64 = ref.UnderlyingType<typeof PIMAGEHLP_MODULE64>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-symbol_info
// typedef struct _SYMBOL_INFO {
//   ULONG   SizeOfStruct;
//   ULONG   TypeIndex;
//   ULONG64 Reserved[2];
//   ULONG   Index;
//   ULONG   Size;
//   ULONG64 ModBase;
//   ULONG   Flags;
//   ULONG64 Value;
//   ULONG64 Address;
//   ULONG   Register;
//   ULONG   Scope;
//   ULONG   Tag;
//   ULONG   NameLen;
//   ULONG   MaxNameLen;
//   CHAR    Name[1];
// } SYMBOL_INFO, *PSYMBOL_INFO;
export const SYMBOL_INFO = StructType({
    SizeOfStruct:       ULONG,
    TypeIndex:          ULONG,
    Reserved:           ArrayType(ULONG64, 2),
    Index:              ULONG,
    Size:               ULONG,
    ModBase:            ULONG64,
    Flags:              ULONG,
    Value:              ULONG64,
    Address:            ULONG64,
    Register:           ULONG,
    Scope:              ULONG,
    Tag:                ULONG,
    NameLen:            ULONG,
    MaxNameLen:         ULONG,
    Name:               ArrayType(CHAR, 1),
});
export type SYMBOL_INFO = ref.UnderlyingType<typeof SYMBOL_INFO>;

export const PSYMBOL_INFO = ref.refType(SYMBOL_INFO);
export type PSYMBOL_INFO = ref.UnderlyingType<typeof PSYMBOL_INFO>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-symbol_infow
// typedef struct _SYMBOL_INFOW {
//   ULONG   SizeOfStruct;
//   ULONG   TypeIndex;
//   ULONG64 Reserved[2];
//   ULONG   Index;
//   ULONG   Size;
//   ULONG64 ModBase;
//   ULONG   Flags;
//   ULONG64 Value;
//   ULONG64 Address;
//   ULONG   Register;
//   ULONG   Scope;
//   ULONG   Tag;
//   ULONG   NameLen;
//   ULONG   MaxNameLen;
//   WCHAR    Name[1];
// } SYMBOL_INFO, *PSYMBOL_INFO;
export const SYMBOL_INFOW = StructType({
    SizeOfStruct:       ULONG,
    TypeIndex:          ULONG,
    Reserved:           ArrayType(ULONG64, 2),
    Index:              ULONG,
    Size:               ULONG,
    ModBase:            ULONG64,
    Flags:              ULONG,
    Value:              ULONG64,
    Address:            ULONG64,
    Register:           ULONG,
    Scope:              ULONG,
    Tag:                ULONG,
    NameLen:            ULONG,
    MaxNameLen:         ULONG,
    Name:               ArrayType(WCHAR, 1),
});
export type SYMBOL_INFOW = ref.UnderlyingType<typeof SYMBOL_INFOW>;

export const PSYMBOL_INFOW = ref.refType(SYMBOL_INFOW);
export type PSYMBOL_INFOW = ref.UnderlyingType<typeof PSYMBOL_INFOW>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-imagehlp_cba_event
// typedef struct _IMAGEHLP_CBA_EVENT {
//   DWORD severity;
//   DWORD code;
//   PCHAR desc;
//   PVOID object;
// } IMAGEHLP_CBA_EVENT, *PIMAGEHLP_CBA_EVENT;
export const IMAGEHLP_CBA_EVENT = StructType({
    severity:   DWORD, // one of the sev* constants
    code:       DWORD, // reserved for future use
    desc:       PCSTR,
    object:     PVOID, // reserved for future use
});
export type IMAGEHLP_CBA_EVENT = ref.UnderlyingType<typeof IMAGEHLP_CBA_EVENT>;

export const sevInfo = 0;
export const sevProblem = 1; // reserved for future use
export const sevAttn = 2; // reserved for future use
export const sevFatal = 3; // reserved for future use

export const PIMAGEHLP_CBA_EVENT = ref.refType(IMAGEHLP_CBA_EVENT);
export type PIMAGEHLP_CBA_EVENT = ref.UnderlyingType<typeof PIMAGEHLP_CBA_EVENT>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-imagehlp_cba_read_memory
// typedef struct _IMAGEHLP_CBA_READ_MEMORY {
//   DWORD64 addr;
//   PVOID   buf;
//   DWORD   bytes;
//   DWORD   *bytesread;
// } IMAGEHLP_CBA_READ_MEMORY, *PIMAGEHLP_CBA_READ_MEMORY;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-imagehlp_deferred_symbol_load
// typedef struct _IMAGEHLP_DEFERRED_SYMBOL_LOAD {
//   DWORD   SizeOfStruct;
//   DWORD   BaseOfImage;
//   DWORD   CheckSum;
//   DWORD   TimeDateStamp;
//   CHAR    FileName[MAX_PATH];
//   BOOLEAN Reparse;
//   HANDLE  hFile;
// } IMAGEHLP_DEFERRED_SYMBOL_LOAD, *PIMAGEHLP_DEFERRED_SYMBOL_LOAD;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/ns-dbghelp-imagehlp_duplicate_symbol
// typedef struct _IMAGEHLP_DUPLICATE_SYMBOL {
//   DWORD            SizeOfStruct;
//   DWORD            NumberOfDups;
//   PIMAGEHLP_SYMBOL Symbol;
//   DWORD            SelectedSymbol;
// } IMAGEHLP_DUPLICATE_SYMBOL, *PIMAGEHLP_DUPLICATE_SYMBOL;

// typedef struct _IMAGEHLP_LINE64 {
//   DWORD   SizeOfStruct;
//   PVOID   Key;
//   DWORD   LineNumber;
//   PCHAR   FileName;
//   DWORD64 Address;
// } IMAGEHLP_LINE64, *PIMAGEHLP_LINE64;
export const IMAGEHLP_LINE64 = StructType({
    SizeOfStruct: DWORD,
    Key: PVOID,
    LineNumber: DWORD,
    FileName: PCSTR,
    Address: DWORD64,
});
export type IMAGEHLP_LINE64 = ref.UnderlyingType<typeof IMAGEHLP_LINE64>;

export const PIMAGEHLP_LINE64 = ref.refType(IMAGEHLP_LINE64);
export type PIMAGEHLP_LINE64 = ref.UnderlyingType<typeof PIMAGEHLP_LINE64>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nc-dbghelp-psym_enumeratesymbols_callback
// PSYM_ENUMERATESYMBOLS_CALLBACK PsymEnumeratesymbolsCallback;
//
// BOOL PsymEnumeratesymbolsCallback(
//   PSYMBOL_INFO pSymInfo,
//   ULONG SymbolSize,
//   PVOID UserContext
// ) { ... }
export const PSYM_ENUMERATESYMBOLS_CALLBACK = ffi.Function(BOOL, [
    PSYMBOL_INFO,   // pSymInfo
    ULONG,          // SymbolSize
    PVOID,          // UserContext
]);
export type PSYM_ENUMERATESYMBOLS_CALLBACK = ref.UnderlyingType<typeof PSYM_ENUMERATESYMBOLS_CALLBACK>;

// https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nc-dbghelp-psym_enummodules_callback
// PSYM_ENUMMODULES_CALLBACK PsymEnummodulesCallback;
//
// BOOL PsymEnummodulesCallback(
//   PCSTR ModuleName,
//   ULONG BaseOfDll,
//   PVOID UserContext
// )
// {...}
export const PSYM_ENUMMODULES_CALLBACK64 = ffi.Function(BOOL, [
    PCSTR,      // ModuleName,
    DWORD64,    // BaseOfDll,
    PVOID,      // UserContext
]);
export type PSYM_ENUMMODULES_CALLBACK64 = ref.UnderlyingType<typeof PSYM_ENUMMODULES_CALLBACK64>;

export const PSYMBOL_REGISTERED_CALLBACK = ffi.Function(BOOL, [
    HANDLE,     // hProcess
    ULONG,      // ActionCode
    "pointer",  // CallbackData
    "pointer",  // UserContext
]);
export type PSYMBOL_REGISTERED_CALLBACK = ref.UnderlyingType<typeof PSYMBOL_REGISTERED_CALLBACK>;

let extensionUri: Uri | undefined;

function dbghelpFactory() {
    if (process.platform !== "win32") return undefined;
    if (extensionUri === undefined) return undefined;

    const dbghelpFile =
        process.arch === "x64" ? Uri.joinPath(extensionUri, "bin/x64/dbghelp.dll").fsPath :
        process.arch === "x86" ? Uri.joinPath(extensionUri, "bin/x86/dbghelp.dll").fsPath :
        undefined;

    if (!dbghelpFile) return undefined;

    return tryExec(() => ffi.Library(dbghelpFile, {
        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-syminitialize
        // BOOL IMAGEAPI SymInitialize(
        //   HANDLE hProcess,
        //   PCSTR  UserSearchPath,
        //   BOOL   fInvadeProcess
        // );
        SymInitialize: [BOOL, [
            HANDLE, // hProcess
            PCSTR,  // UserSearchPath
            BOOL,   // fInvadeProcess
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symcleanup
        // BOOL IMAGEAPI SymCleanup(
        //   HANDLE hProcess
        // );
        SymCleanup: [BOOL, [
            HANDLE, // hProcess
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symgetoptions
        // DWORD IMAGEAPI SymGetOptions();
        SymGetOptions: [DWORD, []],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symsetoptions
        // DWORD IMAGEAPI SymSetOptions(
        //   DWORD SymOptions
        // );
        SymSetOptions: [DWORD, [
            DWORD,  // SymOptions
        ]],

        SymGetSearchPath: [BOOL, [
            HANDLE, // hProcess,
            PSTR,   // SearchPath,
            DWORD,  // SearchPathLength
        ]],

        SymGetSearchPathW: [BOOL, [
            HANDLE, // hProcess,
            PWSTR,  // SearchPath,
            DWORD,  // SearchPathLength
        ]],

        SymSetSearchPath: [BOOL, [
            HANDLE, // hProcess,
            PCSTR,  // SearchPath
        ]],

        SymSetSearchPathW: [BOOL, [
            HANDLE, // hProcess,
            PCWSTR, // SearchPath
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symloadmoduleex
        // DWORD64 IMAGEAPI SymLoadModuleEx(
        //   HANDLE        hProcess,
        //   HANDLE        hFile,
        //   PCSTR         ImageName,
        //   PCSTR         ModuleName,
        //   DWORD64       BaseOfDll,
        //   DWORD         DllSize,
        //   PMODLOAD_DATA Data,
        //   DWORD         Flags
        // );
        SymLoadModuleEx: [DWORD64, [
            HANDLE,     // hProcess
            HANDLE,     // hFile
            PCSTR,      // ImageName
            PCSTR,      // ModuleName
            DWORD64,    // BaseOfDll
            DWORD,      // DllSize
            PVOID,      // Data
            DWORD,      // Flags
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symgetmoduleinfo64
        // BOOL IMAGEAPI SymGetModuleInfo64(
        //   HANDLE             hProcess,
        //   DWORD64            qwAddr,
        //   PIMAGEHLP_MODULE64 ModuleInfo
        // );
        SymGetModuleInfo64: [BOOL, [
            HANDLE,             // hProcess
            DWORD64,            // qwAddr
            PIMAGEHLP_MODULE64, // ModuleInfo
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symunloadmodule64
        // BOOL IMAGEAPI SymUnloadModule64(
        //   HANDLE  hProcess,
        //   DWORD64 BaseOfDll
        // );
        SymUnloadModule64: [BOOL, [
            HANDLE,     // hProcess
            DWORD64,    // BaseOfDll
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symenumsymbols
        // BOOL IMAGEAPI SymEnumSymbols(
        //   HANDLE                         hProcess,
        //   ULONG64                        BaseOfDll,
        //   PCSTR                          Mask,
        //   PSYM_ENUMERATESYMBOLS_CALLBACK EnumSymbolsCallback,
        //   PVOID                          UserContext
        // );
        SymEnumSymbols: [BOOL, [
            HANDLE,                         // hProcess
            ULONG64,                        // BaseOfDll
            PCSTR,                          // Mask
            PSYM_ENUMERATESYMBOLS_CALLBACK, // EnumSymbolsCallback
            PVOID,                          // UserContext
        ]],

        SymFromAddr: [BOOL, [
            HANDLE, // hProcess
            DWORD64, // Address
            PDWORD64, // Displacement
            PSYMBOL_INFO, // Symbol
        ]],

        SymFromAddrW: [BOOL, [
            HANDLE, // hProcess
            DWORD64, // Address
            PDWORD64, // Displacement
            PSYMBOL_INFOW, // Symbol
        ]],

        SymNext: [BOOL, [
            HANDLE, // hProcess
            PSYMBOL_INFO, // si
        ]],

        SymNextW: [BOOL, [
            HANDLE, // hProcess
            PSYMBOL_INFOW, // si
        ]],

        SymEnumerateModules64: [BOOL, [
            HANDLE,                         // hProcess
            PSYM_ENUMMODULES_CALLBACK64,    // EnumModulesCallback,
            PVOID,                          // UserContext
        ]],

        SymRegisterCallback64: [BOOL, [
            HANDLE, // hProcess
            PSYMBOL_REGISTERED_CALLBACK, // CallbackFunction
            PVOID,  // UserContext
        ]],

        // BOOL IMAGEAPI SymGetLineFromAddr64(
        //   HANDLE           hProcess,
        //   DWORD64          qwAddr,
        //   PDWORD           pdwDisplacement,
        //   PIMAGEHLP_LINE64 Line64
        // );
        SymGetLineFromAddr64: [BOOL, [
            HANDLE,
            DWORD64,
            PDWORD,
            PIMAGEHLP_LINE64,
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-undecoratesymbolname
        // DWORD IMAGEAPI UnDecorateSymbolName(
        //   PCSTR name,
        //   PSTR  outputString,
        //   DWORD maxStringLength,
        //   DWORD flags
        // )
        UnDecorateSymbolName: [DWORD, [
            PCSTR,  // name
            PSTR,   // outputString
            DWORD,  // maxStringLength
            DWORD,  // flags
        ]]
    }), e => {
        console.error(e);
        debugger;
    });
}

export const SYMOPT_CASE_INSENSITIVE =              0x00000001;
export const SYMOPT_UNDNAME =                       0x00000002;
export const SYMOPT_DEFERRED_LOADS =                0x00000004;
export const SYMOPT_NO_CPP =                        0x00000008;
export const SYMOPT_LOAD_LINES =                    0x00000010;
export const SYMOPT_OMAP_FIND_NEAREST =             0x00000020;
export const SYMOPT_LOAD_ANYTHING =                 0x00000040;
export const SYMOPT_IGNORE_CVREC =                  0x00000080;
export const SYMOPT_NO_UNQUALIFIED_LOADS =          0x00000100;
export const SYMOPT_FAIL_CRITICAL_ERRORS =          0x00000200;
export const SYMOPT_EXACT_SYMBOLS =                 0x00000400;
export const SYMOPT_ALLOW_ABSOLUTE_SYMBOLS =        0x00000800;
export const SYMOPT_IGNORE_NT_SYMPATH =             0x00001000;
export const SYMOPT_INCLUDE_32BIT_MODULES =         0x00002000;
export const SYMOPT_PUBLICS_ONLY =                  0x00004000;
export const SYMOPT_NO_PUBLICS =                    0x00008000;
export const SYMOPT_AUTO_PUBLICS =                  0x00010000;
export const SYMOPT_NO_IMAGE_SEARCH =               0x00020000;
export const SYMOPT_SECURE =                        0x00040000;
export const SYMOPT_NO_PROMPTS =                    0x00080000;
export const SYMOPT_OVERWRITE =                     0x00100000;
export const SYMOPT_IGNORE_IMAGEDIR =               0x00200000;
export const SYMOPT_FAVOR_COMPRESSED =              0x00800000;
export const SYMOPT_DEBUG =                         0x80000000;

export const CBA_DEFERRED_SYMBOL_LOAD_START =       0x00000001; // Deferred symbol load has started. The CallbackData parameter is a pointer to a IMAGEHLP_DEFERRED_SYMBOL_LOAD64 structure.
export const CBA_DEFERRED_SYMBOL_LOAD_COMPLETE =    0x00000002; // Deferred symbol load has completed. The CallbackData parameter is a pointer to a IMAGEHLP_DEFERRED_SYMBOL_LOAD64 structure.
export const CBA_DEFERRED_SYMBOL_LOAD_FAILURE =     0x00000003; // Deferred symbol load has failed. The CallbackData parameter is a pointer to a IMAGEHLP_DEFERRED_SYMBOL_LOAD64 structure. The symbol handler will attempt to load the symbols again if the callback function sets the FileName member of this structure.
export const CBA_SYMBOLS_UNLOADED =                 0x00000004; // Symbols have been unloaded. The CallbackData parameter should be ignored.
export const CBA_DUPLICATE_SYMBOL =                 0x00000005; // Duplicate symbols were found. This reason is used only in COFF or CodeView format. The CallbackData parameter is a pointer to a IMAGEHLP_DUPLICATE_SYMBOL64 structure. To specify which symbol to use, set the SelectedSymbol member of this structure.
export const CBA_READ_MEMORY =                      0x00000006; // The loaded image has been read. The CallbackData parameter is a pointer to a IMAGEHLP_CBA_READ_MEMORY structure. The callback function should read the number of bytes specified by the bytes member into the buffer specified by the buf member, and update the bytesread member accordingly.
export const CBA_DEFERRED_SYMBOL_LOAD_CANCEL =      0x00000007; // Deferred symbol loading has started. To cancel the symbol load, return TRUE. The CallbackData parameter is a pointer to a IMAGEHLP_DEFERRED_SYMBOL_LOAD64 structure.
export const CBA_SET_OPTIONS =                      0x00000008; // Symbol options have been updated. To retrieve the current options, call the SymGetOptions function. The CallbackData parameter should be ignored.
export const CBA_EVENT =                            0x00000010; // Display verbose information. If you do not handle this event, the information is resent through the CBA_DEBUG_INFO event. The CallbackData parameter is a pointer to a IMAGEHLP_CBA_EVENT structure.
export const CBA_DEFERRED_SYMBOL_LOAD_PARTIAL =     0x00000020; // Deferred symbol load has partially completed. The symbol loader is unable to read the image header from either the image file or the specified module. The CallbackData parameter is a pointer to a IMAGEHLP_DEFERRED_SYMBOL_LOAD64 structure. The symbol handler will attempt to load the symbols again if the callback function sets the FileName member of this structure.
export const CBA_DEBUG_INFO =                       0x10000000; // Display verbose information. The CallbackData parameter is a pointer to a string.
export const CBA_SRCSRV_INFO =                      0x20000000; // Display verbose information for source server. The CallbackData parameter is a pointer to a string.
export const CBA_SRCSRV_EVENT =                     0x40000000; // Display verbose information for source server. If you do not handle this event, the information is resent through the CBA_DEBUG_INFO event. The CallbackData parameter is a pointer to a IMAGEHLP_CBA_EVENT structure.

export const UNDNAME_COMPLETE =                     0x00000000; // Enable full undecoration.
export const UNDNAME_NO_LEADING_UNDERSCORES =       0x00000001; // Remove leading underscores from Microsoft keywords.
export const UNDNAME_NO_MS_KEYWORDS =               0x00000002; // Disable expansion of Microsoft keywords.
export const UNDNAME_NO_FUNCTION_RETURNS =          0x00000004; // Disable expansion of return types for primary declarations.
export const UNDNAME_NO_ALLOCATION_MODEL =          0x00000008; // Disable expansion of the declaration model.
export const UNDNAME_NO_ALLOCATION_LANGUAGE =       0x00000010; // Disable expansion of the declaration language specifier.
export const UNDNAME_NO_MS_THISTYPE =               0x00000020; // Disable expansion of Microsoft keywords on the this type for primary declaration.
export const UNDNAME_NO_CV_THISTYPE =               0x00000040; // Disable expansion of CodeView modifiers on the this type for primary declaration.
export const UNDNAME_NO_ACCESS_SPECIFIERS =         0x00000080; // Disable expansion of access specifiers for members.
export const UNDNAME_NO_THROW_SIGNATURES =          0x00000100; // Disable expansion of throw-signatures for functions and pointers to functions.
export const UNDNAME_NO_MEMBER_TYPE =               0x00000200; // Disable expansion of the static or virtual attribute of members.
export const UNDNAME_NO_RETURN_UDT_MODEL =          0x00000400; // Disable expansion of the Microsoft model for user-defined type returns.
export const UNDNAME_32_BIT_DECODE =                0x00000800; // Undecorate 32-bit decorated names.
export const UNDNAME_NAME_ONLY =                    0x00001000; // Undecorate only the name for primary declaration. Returns [scope::]name. Does expand template parameters.
export const UNDNAME_NO_ARGUMENTS =                 0x00002000; // Do not undecorate function arguments.
export const UNDNAME_NO_SPECIAL_SYMS =              0x00004000; // Do not undecorate special names, such as vtable, vcall, vector, metatype, and so on.
export const UNDNAME_NO_TYPE_PREFIX =               0x00008000; // Disable enum/class/struct/union prefix
export const UNDNAME_NO_PTR64_EXPANSION =           0x00020000; // Disable expansion of __ptr64 keyword

export class Dbghelp {
    #dbghelp;

    constructor(extensionUri: Uri) {
        if (process.platform !== "win32") {
            throw new Error("Wrong platform");
        }

        const dbghelpFile =
            process.arch === "x64" ? Uri.joinPath(extensionUri, "bin/x64/dbghelp.dll").fsPath :
            process.arch === "x86" ? Uri.joinPath(extensionUri, "bin/x86/dbghelp.dll").fsPath :
            undefined;

        if (!dbghelpFile) {
            throw new Error("Unsupported architecture");
        }

        this.#dbghelp = ffi.Library(dbghelpFile, {
            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-syminitialize
            // BOOL IMAGEAPI SymInitialize(
            //   HANDLE hProcess,
            //   PCSTR  UserSearchPath,
            //   BOOL   fInvadeProcess
            // );
            SymInitialize: [BOOL, [
                HANDLE, // hProcess
                PCSTR,  // UserSearchPath
                BOOL,   // fInvadeProcess
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symcleanup
            // BOOL IMAGEAPI SymCleanup(
            //   HANDLE hProcess
            // );
            SymCleanup: [BOOL, [
                HANDLE, // hProcess
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symgetoptions
            // DWORD IMAGEAPI SymGetOptions();
            SymGetOptions: [DWORD, []],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symsetoptions
            // DWORD IMAGEAPI SymSetOptions(
            //   DWORD SymOptions
            // );
            SymSetOptions: [DWORD, [
                DWORD,  // SymOptions
            ]],

            SymGetSearchPath: [BOOL, [
                HANDLE, // hProcess,
                PSTR,   // SearchPath,
                DWORD,  // SearchPathLength
            ]],

            SymGetSearchPathW: [BOOL, [
                HANDLE, // hProcess,
                PWSTR,  // SearchPath,
                DWORD,  // SearchPathLength
            ]],

            SymSetSearchPath: [BOOL, [
                HANDLE, // hProcess,
                PCSTR,  // SearchPath
            ]],

            SymSetSearchPathW: [BOOL, [
                HANDLE, // hProcess,
                PCWSTR, // SearchPath
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symloadmoduleex
            // DWORD64 IMAGEAPI SymLoadModuleEx(
            //   HANDLE        hProcess,
            //   HANDLE        hFile,
            //   PCSTR         ImageName,
            //   PCSTR         ModuleName,
            //   DWORD64       BaseOfDll,
            //   DWORD         DllSize,
            //   PMODLOAD_DATA Data,
            //   DWORD         Flags
            // );
            SymLoadModuleEx: [DWORD64, [
                HANDLE,     // hProcess
                HANDLE,     // hFile
                PCSTR,      // ImageName
                PCSTR,      // ModuleName
                DWORD64,    // BaseOfDll
                DWORD,      // DllSize
                PVOID,      // Data
                DWORD,      // Flags
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symgetmoduleinfo64
            // BOOL IMAGEAPI SymGetModuleInfo64(
            //   HANDLE             hProcess,
            //   DWORD64            qwAddr,
            //   PIMAGEHLP_MODULE64 ModuleInfo
            // );
            SymGetModuleInfo64: [BOOL, [
                HANDLE,             // hProcess
                DWORD64,            // qwAddr
                PIMAGEHLP_MODULE64, // ModuleInfo
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symunloadmodule64
            // BOOL IMAGEAPI SymUnloadModule64(
            //   HANDLE  hProcess,
            //   DWORD64 BaseOfDll
            // );
            SymUnloadModule64: [BOOL, [
                HANDLE,     // hProcess
                DWORD64,    // BaseOfDll
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-symenumsymbols
            // BOOL IMAGEAPI SymEnumSymbols(
            //   HANDLE                         hProcess,
            //   ULONG64                        BaseOfDll,
            //   PCSTR                          Mask,
            //   PSYM_ENUMERATESYMBOLS_CALLBACK EnumSymbolsCallback,
            //   PVOID                          UserContext
            // );
            SymEnumSymbols: [BOOL, [
                HANDLE,                         // hProcess
                ULONG64,                        // BaseOfDll
                PCSTR,                          // Mask
                PSYM_ENUMERATESYMBOLS_CALLBACK, // EnumSymbolsCallback
                PVOID,                          // UserContext
            ]],

            SymFromAddr: [BOOL, [
                HANDLE, // hProcess
                DWORD64, // Address
                PDWORD64, // Displacement
                PSYMBOL_INFO, // Symbol
            ]],

            SymFromAddrW: [BOOL, [
                HANDLE, // hProcess
                DWORD64, // Address
                PDWORD64, // Displacement
                PSYMBOL_INFOW, // Symbol
            ]],

            SymNext: [BOOL, [
                HANDLE, // hProcess
                PSYMBOL_INFO, // si
            ]],

            SymNextW: [BOOL, [
                HANDLE, // hProcess
                PSYMBOL_INFOW, // si
            ]],

            SymEnumerateModules64: [BOOL, [
                HANDLE,                         // hProcess
                PSYM_ENUMMODULES_CALLBACK64,    // EnumModulesCallback,
                PVOID,                          // UserContext
            ]],

            SymRegisterCallback64: [BOOL, [
                HANDLE, // hProcess
                PSYMBOL_REGISTERED_CALLBACK, // CallbackFunction
                PVOID,  // UserContext
            ]],

            // BOOL IMAGEAPI SymGetLineFromAddr64(
            //   HANDLE           hProcess,
            //   DWORD64          qwAddr,
            //   PDWORD           pdwDisplacement,
            //   PIMAGEHLP_LINE64 Line64
            // );
            SymGetLineFromAddr64: [BOOL, [
                HANDLE,
                DWORD64,
                PDWORD,
                PIMAGEHLP_LINE64,
            ]],

            // https://docs.microsoft.com/en-us/windows/win32/api/dbghelp/nf-dbghelp-undecoratesymbolname
            // DWORD IMAGEAPI UnDecorateSymbolName(
            //   PCSTR name,
            //   PSTR  outputString,
            //   DWORD maxStringLength,
            //   DWORD flags
            // )
            UnDecorateSymbolName: [DWORD, [
                PCSTR,  // name
                PSTR,   // outputString
                DWORD,  // maxStringLength
                DWORD,  // flags
            ]]
        });
    }

    SymInitialize(
        handle: HANDLE,
        userSearchPath: PCSTR = null,
        invadeProcess: BOOL = false
    ): BOOL {
        return this.#dbghelp.SymInitialize(
            handle,
            userSearchPath,
            invadeProcess
        );
    }

    SymCleanup(
        handle: HANDLE
    ): BOOL {
        return this.#dbghelp.SymCleanup(
            handle
        );
    }

    SymGetOptions(): DWORD {
        return this.#dbghelp.SymGetOptions();
    }

    SymSetOptions(
        opts: DWORD
    ): DWORD {
        return this.#dbghelp.SymSetOptions(
            opts
        );
    }

    SymLoadModuleEx(
        hProcess:   HANDLE,
        hFile:      HANDLE,
        ImageName:  PCSTR,
        ModuleName: PCSTR,
        BaseOfDll:  DWORD64,
        DllSize:    DWORD,
        Data:       PVOID,
        Flags:      DWORD
    ): DWORD64 {
        return this.#dbghelp.SymLoadModuleEx(
            hProcess,
            hFile,
            ImageName,
            ModuleName,
            BaseOfDll,
            DllSize,
            Data,
            Flags
        );
    }

    SymGetModuleInfo64(
        hProcess:   HANDLE,
        qwAddr:     DWORD64,
        ModuleInfo: PIMAGEHLP_MODULE64
    ) {
        return this.#dbghelp.SymGetModuleInfo64(
            hProcess,
            qwAddr,
            ModuleInfo
        );
    }

    SymUnloadModule64(
        hProcess:   HANDLE,
        BaseOfDll:  DWORD64
    ) {
        return this.#dbghelp.SymUnloadModule64(
            hProcess,
            BaseOfDll
        );
    }

    SymGetSearchPath(
        hProcess: HANDLE,
        SearchPath: PSTR,
        SearchPathLength: DWORD
    ): BOOL {
        return this.#dbghelp.SymGetSearchPath(
            hProcess,
            SearchPath,
            SearchPathLength
        );
    }

    SymGetSearchPathW(
        hProcess: HANDLE,
        SearchPath: PWSTR,
        SearchPathLength: DWORD
    ): BOOL {
        return this.#dbghelp.SymGetSearchPathW(
            hProcess,
            SearchPath,
            SearchPathLength
        );
    }

    SymSetSearchPath(
        hProcess: HANDLE,
        SearchPath: PCSTR
    ): BOOL {
        return this.#dbghelp.SymSetSearchPath(
            hProcess,
            SearchPath
        );
    }

    SymSetSearchPathW(
        hProcess: HANDLE,
        SearchPath: PCWSTR
    ): BOOL {
        return this.#dbghelp.SymSetSearchPathW(
            hProcess,
            SearchPath
        );
    }

    SymEnumerateModules64(
        hProcess:               HANDLE,
        EnumModulesCallback:    PSYM_ENUMMODULES_CALLBACK64,
        UserContext:            PVOID,
    ) {
        return this.#dbghelp.SymEnumerateModules64(
            hProcess,
            EnumModulesCallback,
            UserContext
        );
    }

    SymEnumSymbols(
        hProcess:               HANDLE,
        BaseOfDll:              ULONG64,
        Mask:                   PCSTR,
        EnumSymbolsCallback:    PSYM_ENUMERATESYMBOLS_CALLBACK,
        UserContext:            PVOID
    ): BOOL {
        return this.#dbghelp.SymEnumSymbols(
            hProcess,
            BaseOfDll,
            Mask,
            EnumSymbolsCallback,
            UserContext
        );
    }

    SymFromAddr(
        hProcess: HANDLE,
        Address: DWORD64,
        Displacement: PDWORD64,
        Symbol: PSYMBOL_INFO
    ): BOOL {
        return this.#dbghelp.SymFromAddr(
            hProcess,
            Address,
            Displacement,
            Symbol
        );
    }

    SymFromAddrW(
        hProcess: HANDLE,
        Address: DWORD64,
        Displacement: PDWORD64,
        Symbol: PSYMBOL_INFOW
    ): BOOL {
        return this.#dbghelp.SymFromAddrW(
            hProcess,
            Address,
            Displacement,
            Symbol
        );
    }

    SymNext(
        hProcess: HANDLE,
        si: PSYMBOL_INFO
    ): BOOL {
        return this.#dbghelp.SymNext(
            hProcess,
            si
        );
    }

    SymNextW(
        hProcess: HANDLE,
        si: PSYMBOL_INFOW
    ): BOOL {
        return this.#dbghelp.SymNextW(
            hProcess,
            si
        );
    }

    SymRegisterCallback64(
        hProcess: HANDLE,
        CallbackFunction: PSYMBOL_REGISTERED_CALLBACK,
        UserContext: PVOID
    ): BOOL {
        return this.#dbghelp.SymRegisterCallback64(
            hProcess,
            CallbackFunction,
            UserContext
        );
    }

    SymGetLineFromAddr64(
        hProcess: HANDLE,
        qwAddr: DWORD64,
        pdwDisplacement: PDWORD,
        Line64: PIMAGEHLP_LINE64
    ): BOOL {
        return this.#dbghelp.SymGetLineFromAddr64(
            hProcess,
            qwAddr,
            pdwDisplacement,
            Line64
        );
    }

    UnDecorateSymbolName(
        name:               PCSTR,
        outputString:       PSTR,
        maxStringLength:    DWORD,
        flags:              DWORD
    ): DWORD {
        return this.#dbghelp.UnDecorateSymbolName(
            name,
            outputString,
            maxStringLength,
            flags
        );
    }

    /** Create a unique handle to act as a process handle. */
    createSimpleHandle() {
        const buffer = Buffer.alloc(ref.sizeof.pointer);
        buffer.writeBigInt64LE(BigInt(1));
        buffer.type = ref.refType(ref.types.void);
        return buffer as HANDLE;
    }

    /** Create a unique handle to act as a process handle. */
    createRandomHandle() {
        const buffer = randomBytes(ref.sizeof.pointer);
        buffer.type = ref.refType(ref.types.void);
        return buffer as HANDLE;
    }
}
