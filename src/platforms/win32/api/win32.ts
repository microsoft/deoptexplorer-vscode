// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as ref from "ref-napi";
import { ArrayType, TypedArray } from "./ref-array";
import { StructObject, StructType } from "./ref-struct";

const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_BIGUINT64 = (BigInt(2) ** BigInt(64)) - BigInt(1);
const MAX_BIGINT64 = (BigInt(2) ** BigInt(63)) - BigInt(1);
const MIN_BIGINT64 = ~MAX_BIGINT64;
const _WIN64 = ref.sizeof.pointer === 8;

function alias<T>(name: string, type: ref.Type<T>, overrides?: Partial<ref.Type<T>>): ref.Type<T>;
function alias<T>(name: string, type: ref.Type<unknown>, overrides: Partial<ref.Type<T>> & Pick<ref.Type<T>, "get" | "set">): ref.Type<T>;
function alias<T>(name: string, type: ref.Type<T>, overrides: Partial<ref.Type<T>> = {}) {
    const alias: ref.Type<T> = Object.create(type, Object.getOwnPropertyDescriptors(overrides));
    alias.name = name;
    return alias;
}

function bigintToStringOrNumber(value: bigint) {
    return value < MIN_SAFE_INTEGER || value > MAX_SAFE_INTEGER ?
        value.toString() :
        Number(value);
}

// MSVC Types

export const bool = ref.types.bool;

export namespace signed {
    /** An 8-bit signed integer */
    export const __int8 = alias("__int8", ref.types.int8);
    /** A 16-bit signed integer */
    export const __int16 = alias("__int16", ref.types.int16);
    /** A 32-bit signed integer */
    export const __int32 = alias("__int32", ref.types.int32);
    /** A 64-bit signed integer */
    export const __int64 = alias<bigint>("__int64", ref.types.int64, {
        get(buffer, offset) {
            return ref.endianness === "LE" ?
                BigInt(buffer.readInt64LE(offset)) :
                BigInt(buffer.readInt64BE(offset));
        },
        set(buffer, offset, value) {
            if (value < MIN_BIGINT64 || value > MAX_BIGINT64) throw new RangeError();
            return ref.endianness === "LE" ?
                buffer.writeInt64LE(bigintToStringOrNumber(value), offset) :
                buffer.writeInt64BE(bigintToStringOrNumber(value), offset);
        }
    });
    /** An 8-bit signed integer */
    export const char = alias("char", __int8);
    /** A 16-bit signed integer */
    export const short = alias("short", __int16);
    /** A 32-bit signed integer */
    export const int = alias("int", __int32);
    /** A 32-bit signed integer */
    export const long = alias("long", __int32);
    /** A 64-bit signed integer */
    export const longlong = alias("long long", __int64);
}

export namespace unsigned {
    /** An 8-bit unsigned integer */
    export const __int8 = alias("unsigned __int8", ref.types.uint8);
    /** A 16-bit unsigned integer */
    export const __int16 = alias("unsigned __int16", ref.types.uint16);
    /** A 32-bit unsigned integer */
    export const __int32 = alias("unsigned __int32", ref.types.uint32);
    /** A 64-bit unsigned integer */
    export const __int64 = alias<bigint>("unsigned __int64", ref.types.uint64, {
        get(buffer, offset) {
            return ref.endianness === "LE" ?
                BigInt(buffer.readUInt64LE(offset)) :
                BigInt(buffer.readUInt64BE(offset));
        },
        set(buffer, offset, value) {
            if (value < 0 || value > MAX_BIGUINT64) throw new RangeError();
            return ref.endianness === "LE" ?
                buffer.writeUInt64LE(bigintToStringOrNumber(value), offset) :
                buffer.writeUInt64BE(bigintToStringOrNumber(value), offset);
        },
    });
    /** An 8-bit unsigned integer */
    export const char = alias("unsigned char", __int8);
    /** A 16-bit unsigned integer */
    export const short = alias("unsigned short", __int16);
    /** A 32-bit unsigned integer */
    export const int = alias("unsigned int", __int32);
    /** A 32-bit unsigned integer */
    export const long = alias("unsigned long", __int32);
    /** A 64-bit unsigned integer */
    export const longlong = alias("unsigned long long", __int64);
}

export import __int8 = signed.__int8;
export import __int16 = signed.__int16;
export import __int32 = signed.__int32;
export import __int64 = signed.__int64;

export import char = signed.char;
export import short = signed.short;
export import int = signed.int;
export import long = signed.long;
export import longlong = signed.longlong;

export import uchar = unsigned.char;
export import ushort = unsigned.short;
export import uint = unsigned.int;
export import ulong = unsigned.long;
export import ulonglong = unsigned.longlong;

/** A 32-bit floating-point number */
export const float = ref.types.float;
/** A 64-bit floating-point number */
export const double = ref.types.double;

/** An 8-bit UTF-8 character */
export const char8_t = alias("char8_t", unsigned.__int8);
/** A 16-bit UTF-16 LE character */
export const char16_t = alias("char16_t", unsigned.__int16);
/** A 32-bit UTF-32 LE character */
export const char32_t = alias("char32_t", unsigned.__int32);
/** A 16-bit "wide" character */
export const wchar_t = alias("wchar_t", unsigned.__int16);

// WIN32 Types

/** A Boolean value (should be `TRUE` or `FALSE`), represented by 32-bits */
export const BOOL = alias<boolean>("BOOL", signed.__int32, {
    get(buffer, offset) { return signed.__int32.get(buffer, offset) !== 0; },
    set(buffer, offset, value) { return signed.__int32.set(buffer, offset, value ? 1 : 0); },
});
export type BOOL = ref.UnderlyingType<typeof BOOL>;

/** A Boolean value (should be `TRUE` or `FALSE`), represented by 8-bits */
export const BOOLEAN = alias("BOOLEAN", bool);
export type BOOLEAN = ref.UnderlyingType<typeof BOOLEAN>;

export const VOID = alias("VOID", ref.types.void);
export type VOID = ref.UnderlyingType<typeof VOID>;

/** A byte (8 bits) */
export const BYTE = alias("BYTE", unsigned.char);
export type BYTE = ref.UnderlyingType<typeof BYTE>;

export const FLOAT = alias("FLOAT", float);
export type FLOAT = ref.UnderlyingType<typeof FLOAT>;

export const CHAR = alias("CHAR", signed.char);
export const CCHAR = alias("CCHAR", signed.char);
export const UCHAR = alias("UCHAR", unsigned.char);
export const WCHAR = alias("WCHAR", wchar_t);
export type CHAR = ref.UnderlyingType<typeof CHAR>;
export type CCHAR = ref.UnderlyingType<typeof CCHAR>;
export type UCHAR = ref.UnderlyingType<typeof UCHAR>;
export type WCHAR = ref.UnderlyingType<typeof WCHAR>;

export const INT8 = alias("INT8", signed.__int8);
export const INT16 = alias("INT16", signed.__int16);
export const INT32 = alias("INT32", signed.__int32);
export const INT64 = alias("INT64", signed.__int64);
export type INT8 = ref.UnderlyingType<typeof INT8>;
export type INT16 = ref.UnderlyingType<typeof INT16>;
export type INT32 = ref.UnderlyingType<typeof INT32>;
export type INT64 = ref.UnderlyingType<typeof INT64>;

export const UINT8 = alias("UINT8", unsigned.__int8);
export const UINT16 = alias("UINT16", unsigned.__int16);
export const UINT32 = alias("UINT32", unsigned.__int32);
export const UINT64 = alias("UINT64", unsigned.__int64);
export type UINT8 = ref.UnderlyingType<typeof UINT8>;
export type UINT16 = ref.UnderlyingType<typeof UINT16>;
export type UINT32 = ref.UnderlyingType<typeof UINT32>;
export type UINT64 = ref.UnderlyingType<typeof UINT64>;

export const LONG32 = alias("LONG32", signed.__int32);
export const LONG64 = alias("LONG64", signed.__int64);
export type LONG32 = ref.UnderlyingType<typeof LONG32>;
export type LONG64 = ref.UnderlyingType<typeof LONG64>;

export const ULONG32 = alias("ULONG32", unsigned.__int32);
export const ULONG64 = alias("ULONG64", unsigned.__int64);
export type ULONG32 = ref.UnderlyingType<typeof ULONG32>;
export type ULONG64 = ref.UnderlyingType<typeof ULONG64>;

export const SHORT = alias("SHORT", signed.__int16);
export const INT = alias("INT", signed.__int32);
export const LONG = alias("LONG", signed.long);
export const LONGLONG = alias("LONGLONG", signed.__int64);
export type SHORT = ref.UnderlyingType<typeof SHORT>;
export type INT = ref.UnderlyingType<typeof INT>;
export type LONG = ref.UnderlyingType<typeof LONG>;
export type LONGLONG = ref.UnderlyingType<typeof LONGLONG>;

export const USHORT = alias("USHORT", unsigned.__int16);
export const UINT = alias("UINT", unsigned.__int32);
export const ULONG = alias("ULONG", unsigned.long);
export const ULONGLONG = alias("ULONGLONG", unsigned.__int64);
export type USHORT = ref.UnderlyingType<typeof USHORT>;
export type UINT = ref.UnderlyingType<typeof UINT>;
export type ULONG = ref.UnderlyingType<typeof ULONG>;
export type ULONGLONG = ref.UnderlyingType<typeof ULONGLONG>;

export const WORD = alias("WORD", unsigned.__int16);
export const DWORD = alias("DWORD", unsigned.__int32);
export const DWORDLONG = alias("DWORDLONG", unsigned.__int64);
export const DWORD32 = alias("DWORD32", unsigned.__int32);
export const DWORD64 = alias("DWORD64", unsigned.__int64);
export const QWORD = alias("QWORD", unsigned.__int64);
export type WORD = ref.UnderlyingType<typeof WORD>;
export type DWORD = ref.UnderlyingType<typeof DWORD>;
export type DWORDLONG = ref.UnderlyingType<typeof DWORDLONG>;
export type DWORD32 = ref.UnderlyingType<typeof DWORD32>;
export type DWORD64 = ref.UnderlyingType<typeof DWORD64>;
export type QWORD = ref.UnderlyingType<typeof QWORD>;

export const INT_PTR = _WIN64 ? alias("INT_PTR", signed.__int64) : alias("INT_PTR", signed.__int32);
export const LONG_PTR = _WIN64 ? alias("LONG_PTR", signed.__int64) : alias("LONG_PTR", signed.__int32);
export const UINT_PTR = _WIN64 ? alias("UINT_PTR", unsigned.__int64) : alias("UINT_PTR", unsigned.__int32);
export const ULONG_PTR = _WIN64 ? alias("ULONG_PTR", unsigned.__int64) : alias("ULONG_PTR", unsigned.__int32);
export type INT_PTR = ref.UnderlyingType<typeof INT_PTR>;
export type LONG_PTR = ref.UnderlyingType<typeof LONG_PTR>;
export type UINT_PTR = ref.UnderlyingType<typeof UINT_PTR>;
export type ULONG_PTR = ref.UnderlyingType<typeof ULONG_PTR>;

export const DWORD_PTR = alias("DWORD_PTR", ULONG_PTR as ref.Type<number | bigint>) as ref.Type<number> | ref.Type<bigint>;
export const SIZE_T = alias("SIZE_T", ULONG_PTR as ref.Type<number | bigint>) as ref.Type<number> | ref.Type<bigint>;
export type DWORD_PTR = ref.UnderlyingType<typeof DWORD_PTR>;
export type SIZE_T = ref.UnderlyingType<typeof SIZE_T>;

export const PVOID: ref.Type<ref.Pointer<unknown>> = alias("PVOID", ref.refType(VOID));
export const LPVOID: ref.Type<ref.Pointer<unknown>> = alias("LPVOID", ref.refType(VOID));
export const LPCVOID: ref.Type<ref.Pointer<unknown>> = alias("LPCVOID", ref.refType(VOID));
export const HANDLE: ref.Type<ref.Pointer<unknown>> = alias("HANDLE", PVOID);
export const HMODULE: ref.Type<ref.Pointer<unknown>> = alias("HMODULE", HANDLE);
export const PHANDLE = alias("PHANDLE", ref.refType(HANDLE));
export type PVOID = ref.UnderlyingType<typeof PVOID>;
export type LPVOID = ref.UnderlyingType<typeof LPVOID>;
export type LPCVOID = ref.UnderlyingType<typeof LPCVOID>;
export type HANDLE = ref.UnderlyingType<typeof HANDLE>;
export type HMODULE = ref.UnderlyingType<typeof HMODULE>;
export type PHANDLE = ref.UnderlyingType<typeof PHANDLE>;

export const LPBOOL = alias("LPBOOL", ref.refType(BOOL));
export const LPBYTE = alias("LPBYTE", ref.refType(BYTE));
export const LPDWORD = alias("LPDWORD", ref.refType(DWORD));
export const LPHANDLE = alias("LPHANDLE", ref.refType(HANDLE));
export const LPINT = alias("LPINT", ref.refType(INT));
export const LPLONG = alias("LPLONG", ref.refType(LONG));
export const LPWORD = alias("LPWORD", ref.refType(WORD));
export type LPBOOL = ref.UnderlyingType<typeof LPBOOL>;
export type LPBYTE = ref.UnderlyingType<typeof LPBYTE>;
export type LPDWORD = ref.UnderlyingType<typeof LPDWORD>;
export type LPHANDLE = ref.UnderlyingType<typeof LPHANDLE>;
export type LPINT = ref.UnderlyingType<typeof LPINT>;
export type LPLONG = ref.UnderlyingType<typeof LPLONG>;
export type LPWORD = ref.UnderlyingType<typeof LPWORD>;

export const PBOOL = alias("PBOOL", ref.refType(BOOL));
export const PBOOLEAN = alias("PBOOLEAN", ref.refType(BOOLEAN));
export const PBYTE = alias("PBYTE", ref.refType(BYTE));
export const PCHAR = alias("PCHAR", ref.refType(CHAR));
export const PDWORD = alias("PDWORD", ref.refType(DWORD));
export const PDWORDLONG = alias("PDWORDLONG", ref.refType(DWORDLONG));
export const PDWORD32 = alias("PDWORD32", ref.refType(DWORD32));
export const PDWORD64 = alias("PDWORD64", ref.refType(DWORD64));
export const PFLOAT = alias("PFLOAT", ref.refType(FLOAT));
export const PINT = alias("PINT", ref.refType(INT));
export const PINT8 = alias("PINT8", ref.refType(INT8));
export const PINT16 = alias("PINT16", ref.refType(INT16));
export const PINT32 = alias("PINT32", ref.refType(INT32));
export const PINT64 = alias("PINT64", ref.refType(INT64));
export const PLONG = alias("PLONG", ref.refType(LONG));
export const PLONGLONG = alias("PLONGLONG", ref.refType(LONGLONG));
export const PLONG32 = alias("PLONG32", ref.refType(LONG32));
export const PLONG64 = alias("PLONG64", ref.refType(LONG64));
export const PSHORT = alias("PSHORT", ref.refType(SHORT));
export const PUCHAR = alias("PUCHAR", ref.refType(UCHAR));
export const PUINT = alias("PUINT", ref.refType(UINT));
export const PUINT8 = alias("PUINT8", ref.refType(UINT8));
export const PUINT16 = alias("PUINT16", ref.refType(UINT16));
export const PUINT32 = alias("PUINT32", ref.refType(UINT32));
export const PUINT64 = alias("PUINT64", ref.refType(UINT64));
export const PULONG = alias("PULONG", ref.refType(ULONG));
export const PULONGLONG = alias("PULONGLONG", ref.refType(ULONGLONG));
export const PULONG32 = alias("PULONG32", ref.refType(ULONG32));
export const PULONG64 = alias("PULONG64", ref.refType(ULONG64));
export const PUSHORT = alias("PUSHORT", ref.refType(USHORT));
export const PWCHAR = alias("PWCHAR", ref.refType(WCHAR));
export const PWORD = alias("PWORD", ref.refType(WORD));
export type PBOOL = ref.UnderlyingType<typeof PBOOL>;
export type PBOOLEAN = ref.UnderlyingType<typeof PBOOLEAN>;
export type PBYTE = ref.UnderlyingType<typeof PBYTE>;
export type PCHAR = ref.UnderlyingType<typeof PCHAR>;
export type PDWORD = ref.UnderlyingType<typeof PDWORD>;
export type PDWORDLONG = ref.UnderlyingType<typeof PDWORDLONG>;
export type PDWORD32 = ref.UnderlyingType<typeof PDWORD32>;
export type PDWORD64 = ref.UnderlyingType<typeof PDWORD64>;
export type PFLOAT = ref.UnderlyingType<typeof PFLOAT>;
export type PINT = ref.UnderlyingType<typeof PINT>;
export type PINT8 = ref.UnderlyingType<typeof PINT8>;
export type PINT16 = ref.UnderlyingType<typeof PINT16>;
export type PINT32 = ref.UnderlyingType<typeof PINT32>;
export type PINT64 = ref.UnderlyingType<typeof PINT64>;
export type PLONG = ref.UnderlyingType<typeof PLONG>;
export type PLONGLONG = ref.UnderlyingType<typeof PLONGLONG>;
export type PLONG32 = ref.UnderlyingType<typeof PLONG32>;
export type PLONG64 = ref.UnderlyingType<typeof PLONG64>;
export type PSHORT = ref.UnderlyingType<typeof PSHORT>;
export type PUCHAR = ref.UnderlyingType<typeof PUCHAR>;
export type PUINT = ref.UnderlyingType<typeof PUINT>;
export type PUINT8 = ref.UnderlyingType<typeof PUINT8>;
export type PUINT16 = ref.UnderlyingType<typeof PUINT16>;
export type PUINT32 = ref.UnderlyingType<typeof PUINT32>;
export type PUINT64 = ref.UnderlyingType<typeof PUINT64>;
export type PULONG = ref.UnderlyingType<typeof PULONG>;
export type PULONGLONG = ref.UnderlyingType<typeof PULONGLONG>;
export type PULONG32 = ref.UnderlyingType<typeof PULONG32>;
export type PULONG64 = ref.UnderlyingType<typeof PULONG64>;
export type PUSHORT = ref.UnderlyingType<typeof PUSHORT>;
export type PWCHAR = ref.UnderlyingType<typeof PWCHAR>;
export type PWORD = ref.UnderlyingType<typeof PWORD>;

export const PDWORD_PTR = alias("PDWORD_PTR", ref.refType(DWORD_PTR));
export const PINT_PTR = alias("PINT_PTR", ref.refType(INT_PTR));
export const PLONG_PTR = alias("PLONG_PTR", ref.refType(LONG_PTR));
export const PULONG_PTR = alias("PULONG_PTR", ref.refType(ULONG_PTR));
export const PUINT_PTR = alias("PUINT_PTR", ref.refType(UINT_PTR));
export const PSIZE_T = alias("PSIZE_T", ref.refType(SIZE_T));
export type PDWORD_PTR = ref.UnderlyingType<typeof PDWORD_PTR>;
export type PINT_PTR = ref.UnderlyingType<typeof PINT_PTR>;
export type PLONG_PTR = ref.UnderlyingType<typeof PLONG_PTR>;
export type PULONG_PTR = ref.UnderlyingType<typeof PULONG_PTR>;
export type PUINT_PTR = ref.UnderlyingType<typeof PUINT_PTR>;
export type PSIZE_T = ref.UnderlyingType<typeof PSIZE_T>;

export const LPCSTR = alias("LPCSTR", ref.types.CString);
export const PCSTR = alias("PCSTR", ref.types.CString);
export const LPSTR = alias("LPSTR", ref.refType(CHAR));
export const PSTR = alias("PSTR", ref.refType(CHAR));
export type LPCSTR = ref.UnderlyingType<typeof LPCSTR>;
export type PCSTR = ref.UnderlyingType<typeof PCSTR>;
export type LPSTR = ref.UnderlyingType<typeof LPSTR>;
export type PSTR = ref.UnderlyingType<typeof PSTR>;

const CWString: ref.Type<string | null> = {
    size: ref.sizeof.pointer,
    alignment: ref.alignof.pointer,
    indirection: 1,
    ffi_type: ref.types.CString.ffi_type,
    get: function get (buf, offset) {
        const _buf = ref.readPointer(buf, offset)
        if (ref.isNull(_buf)) {
            return null;
        }
        const _buf2 = ref.reinterpretUntilZeros(_buf, 2, 0);
        return _buf2.toString("utf16le");
    },
    set: function set (buf, offset, val) {
        let _buf
        if (Buffer.isBuffer(val)) {
            _buf = val;
        } else {
            _buf = ref.allocCString(val, "utf16le");
        }
        return ref.writePointer(buf, offset, _buf);
    }
};

// can't do wide characters since native bindings don't support them
export const LPCWSTR = alias("LPCWSTR", CWString);
export const PCWSTR = alias("PCWSTR", CWString);
export const LPWSTR = alias("LPWSTR", ref.refType(WCHAR));
export const PWSTR = alias("PWSTR", ref.refType(WCHAR));
export type LPCWSTR = ref.UnderlyingType<typeof LPCWSTR>;
export type PCWSTR = ref.UnderlyingType<typeof PCWSTR>;
export type LPWSTR = ref.UnderlyingType<typeof LPWSTR>;
export type PWSTR = ref.UnderlyingType<typeof PWSTR>;

// const LPCTSTR = unicode ? LPCWSTR : LPCSTR;
// const LPTSTR = unicode ? LPWSTR : LPSTR;
// const PCTSTR = unicode ? PCWSTR : PCSTR;

export const GUID = StructType({
    Data1: unsigned.long,
    Data2: unsigned.short,
    Data3: unsigned.short,
    Data4: ArrayType(unsigned.char, 8),
});
export type GUID = ref.UnderlyingType<typeof GUID>;

export function sizeof(type: ref.TypeLike) {
    type = ref.coerceType(type);
    return type.size;
}

export function reinterpret_cast<T extends ref.TypeLike>(value: Buffer | StructObject<any> | TypedArray<any>, type: T): ref.UnderlyingType<T>;
export function reinterpret_cast(value: Buffer | StructObject<{}> | TypedArray<any>, type: ref.TypeLike, offset?: number) {
    type = ref.coerceType(type);
    let valueBuffer: Buffer;
    if (Buffer.isBuffer(value)) {
        valueBuffer = value;
    }
    else {
        valueBuffer = value.ref();
    }

    const reinterpretBuffer = ref.reinterpret(valueBuffer, type.size, offset);
    if (!reinterpretBuffer.type) {
        reinterpretBuffer.type = type;
    }
    return ref.get(reinterpretBuffer, 0, type);
}