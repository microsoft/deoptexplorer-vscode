// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { lazy } from "@esfx/fn";
import { tryExec } from "#core/utils.js";
import * as ffi from "ffi-napi";
import * as ref from "ref-napi";
import { BOOL, DWORD, HANDLE, HMODULE, LPCSTR, LPCVOID, LPSTR, PCSTR, PSTR, PVOID } from "./win32";

export function LoadLibraryEx(
    lpLibFileName:  LPCSTR,
    hFile:          HANDLE,
    dwFlags:        DWORD,
): HMODULE {
    return kernel32().LoadLibraryExA(
        lpLibFileName,
        hFile,
        dwFlags
    );
}

export function FreeLibrary(
    hLibModule:     HMODULE
): BOOL {
    return kernel32().FreeLibrary(hLibModule);
}

export function GetCurrentProcess() {
    return kernel32().GetCurrentProcess();
}

export function GetLastError() {
    return ffi.errno();
}

export function FormatErrorMessage(lMessageId: DWORD) {
    const buffer = Buffer.alloc(4096) as PSTR;
    const byteLength = kernel32().FormatMessageA(
        0x00001000 | 0x00000200,
        ref.NULL_POINTER,
        lMessageId,
        0,
        buffer,
        buffer.byteLength,
        ref.NULL_POINTER
    );
    return buffer.toString("utf8", 0, +byteLength);
}

export const DONT_RESOLVE_DLL_REFERENCES = 0x1;
export const LOAD_LIBRARY_AS_DATAFILE = 0x2;

const _kernel32 = lazy(() => {
    if (process.platform !== "win32") return undefined;
    return tryExec(() => ffi.Library("kernel32", {
        // https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibraryexa
        // HMODULE LoadLibraryExA(
        //   LPCSTR lpLibFileName,
        //   HANDLE hFile,
        //   DWORD  dwFlags
        // );
        LoadLibraryExA: [HANDLE, [
            PCSTR,  // lpLibFileName
            HANDLE, // hFile
            DWORD,  // dwFlags
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-freelibrary
        // BOOL FreeLibrary(
        //   HMODULE hLibModule
        // );
        FreeLibrary: [BOOL, [
            HMODULE, // hLibModule
        ]],

        // https://docs.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getcurrentprocess
        // HANDLE GetCurrentProcess();
        GetCurrentProcess: [HANDLE, []],

        // https://docs.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-formatmessagea
        // DWORD FormatMessageA(
        //   DWORD   dwFlags,
        //   LPCVOID lpSource,
        //   DWORD   dwMessageId,
        //   DWORD   dwLanguageId,
        //   LPSTR   lpBuffer,
        //   DWORD   nSize,
        //   va_list *Arguments
        // );
        FormatMessageA: [DWORD, [
            DWORD,      // dwFlags,
            LPCVOID,    // lpSource,
            DWORD,      // dwMessageId,
            DWORD,      // dwLanguageId,
            LPSTR,      // lpBuffer,
            DWORD,      // nSize,
            PVOID,      // *Arguments
        ]],
    }));
});

function kernel32() {
    const kernel32 = _kernel32();
    if (!kernel32) throw new ReferenceError("Module could not be loaded. Check `isAvailable()` before calling debug apis.");
    return kernel32;
}

export function isAvailable() {
    return _kernel32() !== undefined;
}

export class Win32Error extends Error {
    readonly errno: number;
    constructor(message?: string, errno = GetLastError()) {
        super(message ? `${message}${/[.:-]$/.test(message) ? " " : /[.:-]\s+$/.test(message) ? "" : ". "}${FormatErrorMessage(errno)}` : FormatErrorMessage(errno));
        this.errno = errno;
    }

    static throwIfNotSuccess(message?: string) {
        const errno = GetLastError();
        if (errno !== 0) {
            throw new Win32Error(message, errno);
        }
    }
}
