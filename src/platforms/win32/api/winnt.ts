// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ArrayType, endianness, PrimitiveType, RuntimeType, StructType } from "@esfx/struct-type";
import { BYTE, DWORD, LONG, ULONG, ULONGLONG, WORD } from "@esfx/struct-type/win32";
import * as fs from "fs";

const IMAGE_DOS_SIGNATURE_LE = 0x5a4d;                                              // MZ (in little-endian)
const IMAGE_NT_SIGNATURE_LE = 0x00004550;                                           // PE00 (in little-endian)

export const IMAGE_NT_OPTIONAL_HDR32_MAGIC = 0x10b;
export const IMAGE_NT_OPTIONAL_HDR64_MAGIC = 0x20b;

/*
typedef struct _IMAGE_DOS_HEADER {      // DOS .EXE header
    WORD   e_magic;                     // Magic number
    WORD   e_cblp;                      // Bytes on last page of file
    WORD   e_cp;                        // Pages in file
    WORD   e_crlc;                      // Relocations
    WORD   e_cparhdr;                   // Size of header in paragraphs
    WORD   e_minalloc;                  // Minimum extra paragraphs needed
    WORD   e_maxalloc;                  // Maximum extra paragraphs needed
    WORD   e_ss;                        // Initial (relative) SS value
    WORD   e_sp;                        // Initial SP value
    WORD   e_csum;                      // Checksum
    WORD   e_ip;                        // Initial IP value
    WORD   e_cs;                        // Initial (relative) CS value
    WORD   e_lfarlc;                    // File address of relocation table
    WORD   e_ovno;                      // Overlay number
    WORD   e_res[4];                    // Reserved words
    WORD   e_oemid;                     // OEM identifier (for e_oeminfo)
    WORD   e_oeminfo;                   // OEM information; e_oemid specific
    WORD   e_res2[10];                  // Reserved words
    LONG   e_lfanew;                    // File address of new exe header
} IMAGE_DOS_HEADER, *PIMAGE_DOS_HEADER;
*/
export type IMAGE_DOS_HEADER = RuntimeType<typeof IMAGE_DOS_HEADER>;
export const IMAGE_DOS_HEADER = StructType({
    e_magic:    WORD,
    e_cblp:     WORD,
    e_cp:       WORD,
    e_crlc:     WORD,
    e_cparhdr:  WORD,
    e_minalloc: WORD,
    e_maxalloc: WORD,
    e_ss:       WORD,
    e_sp:       WORD,
    e_csum:     WORD,
    e_ip:       WORD,
    e_cs:       WORD,
    e_lfarlc:   WORD,
    e_ovno:     WORD,
    e_res:      ArrayType(WORD, 4),
    e_oemid:    WORD,
    e_oeminfo:  WORD,
    e_res2:     ArrayType(WORD, 10),
    e_lfanew:   LONG,
});

/*
typedef struct _IMAGE_FILE_HEADER {
    WORD    Machine;
    WORD    NumberOfSections;
    DWORD   TimeDateStamp;
    DWORD   PointerToSymbolTable;
    DWORD   NumberOfSymbols;
    WORD    SizeOfOptionalHeader;
    WORD    Characteristics;
} IMAGE_FILE_HEADER, *PIMAGE_FILE_HEADER;
*/
export type IMAGE_FILE_HEADER = RuntimeType<typeof IMAGE_FILE_HEADER>;
export const IMAGE_FILE_HEADER = StructType({
    Machine:                WORD,
    NumberOfSections:       WORD,
    TimeDateStamp:          DWORD,
    PointerToSymbolTable:   DWORD,
    NumberOfSymbols:        DWORD,
    SizeOfOptionalHeader:   WORD,
    Characteristics:        WORD,
});

export const IMAGE_NUMBEROF_DIRECTORY_ENTRIES = 16;

/*
typedef struct _IMAGE_DATA_DIRECTORY {
    ULONG   VirtualAddress;
    ULONG   Size;
} IMAGE_DATA_DIRECTORY, *PIMAGE_DATA_DIRECTORY;
*/
export type IMAGE_DATA_DIRECTORY = RuntimeType<typeof IMAGE_DATA_DIRECTORY>;
export const IMAGE_DATA_DIRECTORY = StructType({
    VirtualAddress: ULONG,
    Size:           ULONG,
});

/*
typedef struct _IMAGE_OPTIONAL_HEADER {
    WORD        Magic;
    BYTE        MajorLinkerVersion;
    BYTE        MinorLinkerVersion;
    DWORD       SizeOfCode;
    DWORD       SizeOfInitializedData;
    DWORD       SizeOfUninitializedData;
    DWORD       AddressOfEntryPoint;
    DWORD       BaseOfCode;
    ULONGLONG   ImageBase;
    DWORD       SectionAlignment;
    DWORD       FileAlignment;
    WORD        MajorOperatingSystemVersion;
    WORD        MinorOperatingSystemVersion;
    WORD        MajorImageVersion;
    WORD        MinorImageVersion;
    WORD        MajorSubsystemVersion;
    WORD        MinorSubsystemVersion;
    DWORD       Win32VersionValue;
    DWORD       SizeOfImage;
    DWORD       SizeOfHeaders;
    DWORD       CheckSum;
    WORD        Subsystem;
    WORD        DllCharacteristics;
    ULONGLONG   SizeOfStackReserve;
    ULONGLONG   SizeOfStackCommit;
    ULONGLONG   SizeOfHeapReserve;
    ULONGLONG   SizeOfHeapCommit;
    DWORD       LoaderFlags;
    DWORD       NumberOfRvaAndSizes;
    IMAGE_DATA_DIRECTORY DataDirectory[IMAGE_NUMBEROF_DIRECTORY_ENTRIES];
} IMAGE_OPTIONAL_HEADER32, *PIMAGE_OPTIONAL_HEADER32;
*/
export type IMAGE_OPTIONAL_HEADER32 = RuntimeType<typeof IMAGE_OPTIONAL_HEADER32>;
export const IMAGE_OPTIONAL_HEADER32 = StructType({
    Magic:                          WORD as PrimitiveType<typeof WORD["name"], typeof IMAGE_NT_OPTIONAL_HDR32_MAGIC>,
    MajorLinkerVersion:             BYTE,
    MinorLinkerVersion:             BYTE,
    SizeOfCode:                     DWORD,
    SizeOfInitializedData:          DWORD,
    SizeOfUninitializedData:        DWORD,
    AddressOfEntryPoint:            DWORD,
    BaseOfCode:                     DWORD,
    ImageBase:                      DWORD,
    SectionAlignment:               DWORD,
    FileAlignment:                  DWORD,
    MajorOperatingSystemVersion:    WORD,
    MinorOperatingSystemVersion:    WORD,
    MajorImageVersion:              WORD,
    MinorImageVersion:              WORD,
    MajorSubsystemVersion:          WORD,
    MinorSubsystemVersion:          WORD,
    Win32VersionValue:              DWORD,
    SizeOfImage:                    DWORD,
    SizeOfHeaders:                  DWORD,
    CheckSum:                       DWORD,
    Subsystem:                      WORD,
    DllCharacteristics:             WORD,
    SizeOfStackReserve:             DWORD,
    SizeOfStackCommit:              DWORD,
    SizeOfHeapReserve:              DWORD,
    SizeOfHeapCommit:               DWORD,
    LoaderFlags:                    DWORD,
    NumberOfRvaAndSizes:            DWORD,
    DataDirectory:                  ArrayType(IMAGE_DATA_DIRECTORY, IMAGE_NUMBEROF_DIRECTORY_ENTRIES),
});

/*
typedef struct _IMAGE_OPTIONAL_HEADER64 {
    WORD        Magic;
    BYTE        MajorLinkerVersion;
    BYTE        MinorLinkerVersion;
    DWORD       SizeOfCode;
    DWORD       SizeOfInitializedData;
    DWORD       SizeOfUninitializedData;
    DWORD       AddressOfEntryPoint;
    DWORD       BaseOfCode;
    ULONGLONG   ImageBase;
    DWORD       SectionAlignment;
    DWORD       FileAlignment;
    WORD        MajorOperatingSystemVersion;
    WORD        MinorOperatingSystemVersion;
    WORD        MajorImageVersion;
    WORD        MinorImageVersion;
    WORD        MajorSubsystemVersion;
    WORD        MinorSubsystemVersion;
    DWORD       Win32VersionValue;
    DWORD       SizeOfImage;
    DWORD       SizeOfHeaders;
    DWORD       CheckSum;
    WORD        Subsystem;
    WORD        DllCharacteristics;
    ULONGLONG   SizeOfStackReserve;
    ULONGLONG   SizeOfStackCommit;
    ULONGLONG   SizeOfHeapReserve;
    ULONGLONG   SizeOfHeapCommit;
    DWORD       LoaderFlags;
    DWORD       NumberOfRvaAndSizes;
    IMAGE_DATA_DIRECTORY DataDirectory[IMAGE_NUMBEROF_DIRECTORY_ENTRIES];
} IMAGE_OPTIONAL_HEADER64, *PIMAGE_OPTIONAL_HEADER64;
*/
export type IMAGE_OPTIONAL_HEADER64 = RuntimeType<typeof IMAGE_OPTIONAL_HEADER64>;
export const IMAGE_OPTIONAL_HEADER64 = StructType({
    Magic:                          WORD as PrimitiveType<typeof WORD["name"], typeof IMAGE_NT_OPTIONAL_HDR64_MAGIC>,
    MajorLinkerVersion:             BYTE,
    MinorLinkerVersion:             BYTE,
    SizeOfCode:                     DWORD,
    SizeOfInitializedData:          DWORD,
    SizeOfUninitializedData:        DWORD,
    AddressOfEntryPoint:            DWORD,
    BaseOfCode:                     DWORD,
    ImageBase:                      ULONGLONG,
    SectionAlignment:               DWORD,
    FileAlignment:                  DWORD,
    MajorOperatingSystemVersion:    WORD,
    MinorOperatingSystemVersion:    WORD,
    MajorImageVersion:              WORD,
    MinorImageVersion:              WORD,
    MajorSubsystemVersion:          WORD,
    MinorSubsystemVersion:          WORD,
    Win32VersionValue:              DWORD,
    SizeOfImage:                    DWORD,
    SizeOfHeaders:                  DWORD,
    CheckSum:                       DWORD,
    Subsystem:                      WORD,
    DllCharacteristics:             WORD,
    SizeOfStackReserve:             ULONGLONG,
    SizeOfStackCommit:              ULONGLONG,
    SizeOfHeapReserve:              ULONGLONG,
    SizeOfHeapCommit:               ULONGLONG,
    LoaderFlags:                    DWORD,
    NumberOfRvaAndSizes:            DWORD,
    DataDirectory:                  ArrayType(IMAGE_DATA_DIRECTORY, IMAGE_NUMBEROF_DIRECTORY_ENTRIES),
});

// // Helper that reads up through the Magic value for the optional header.
// const _IMAGE_NT_HEADERS = StructType({
//     Signature: DWORD,
//     FileHeader: IMAGE_FILE_HEADER,
//     OptionalHeaderMagic: WORD
// });

/*
typedef struct _IMAGE_NT_HEADERS {
    DWORD Signature;
    IMAGE_FILE_HEADER FileHeader;
    IMAGE_OPTIONAL_HEADER32 OptionalHeader;
} IMAGE_NT_HEADERS32, *PIMAGE_NT_HEADERS32;
*/
export type IMAGE_NT_HEADERS32 = RuntimeType<typeof IMAGE_NT_HEADERS32>;
export const IMAGE_NT_HEADERS32 = StructType({
    Signature:      DWORD,
    FileHeader:     IMAGE_FILE_HEADER,
    OptionalHeader: IMAGE_OPTIONAL_HEADER32,
});

/*
typedef struct _IMAGE_NT_HEADERS64 {
    DWORD Signature;
    IMAGE_FILE_HEADER FileHeader;
    IMAGE_OPTIONAL_HEADER64 OptionalHeader;
} IMAGE_NT_HEADERS64, *PIMAGE_NT_HEADERS64;
*/
export type IMAGE_NT_HEADERS64 = RuntimeType<typeof IMAGE_NT_HEADERS64>;
export const IMAGE_NT_HEADERS64 = StructType({
    Signature:      DWORD,
    FileHeader:     IMAGE_FILE_HEADER,
    OptionalHeader: IMAGE_OPTIONAL_HEADER64,
});

export function getImageHeaders(file: string) {
    const fd = fs.openSync(file, fs.constants.O_RDONLY);
    try {
        // read the DOS header
        let dos_header: IMAGE_DOS_HEADER | undefined = endianness === "LE" ? new IMAGE_DOS_HEADER() : undefined;
        const dos_header_size = IMAGE_DOS_HEADER.SIZE;
        const dos_header_bytes = dos_header ? new Uint8Array(dos_header.buffer) : new Uint8Array(dos_header_size);
        if (fs.readSync(fd, dos_header_bytes, { position: 0, length: dos_header_size }) === dos_header_size) {
            dos_header ??= IMAGE_DOS_HEADER.read(dos_header_bytes.buffer, 0, "LE");
            if (dos_header.e_magic === IMAGE_DOS_SIGNATURE_LE) {
                // Try to read the NT header as a 32-bit PE
                let nt_headers32: IMAGE_NT_HEADERS32 | undefined = endianness === "LE" ? new IMAGE_NT_HEADERS32() : undefined;
                const nt_headers32_size = IMAGE_NT_HEADERS32.SIZE;
                const nt_headers32_bytes = nt_headers32 ? new Uint8Array(nt_headers32.buffer) : new Uint8Array(nt_headers32_size);
                if (fs.readSync(fd, nt_headers32_bytes, { position: dos_header.e_lfanew, length: nt_headers32_size }) === nt_headers32_size) {
                    nt_headers32 ??= IMAGE_NT_HEADERS32.read(nt_headers32_bytes.buffer, 0, "LE");
                    if (nt_headers32.Signature === IMAGE_NT_SIGNATURE_LE && nt_headers32.OptionalHeader.Magic === IMAGE_NT_OPTIONAL_HDR32_MAGIC) {
                        return nt_headers32;
                    }
                }

                // Try to read the NT header as a 64-bit PE
                let nt_headers64: IMAGE_NT_HEADERS64 | undefined = endianness === "LE" ? new IMAGE_NT_HEADERS64() : undefined;
                const nt_headers64_size = IMAGE_NT_HEADERS64.SIZE;
                const nt_headers64_bytes = nt_headers64 ? new Uint8Array(nt_headers64.buffer) : new Uint8Array(nt_headers64_size);
                if (fs.readSync(fd, nt_headers64_bytes, { position: dos_header.e_lfanew, length: nt_headers64_size }) === nt_headers64_size) {
                    nt_headers64 ??= IMAGE_NT_HEADERS64.read(nt_headers64_bytes.buffer, 0, "LE");
                    if (nt_headers64.Signature === IMAGE_NT_SIGNATURE_LE && nt_headers64.OptionalHeader.Magic === IMAGE_NT_OPTIONAL_HDR64_MAGIC) {
                        return nt_headers64;
                    }
                }
            }
        }

        return undefined;
    }
    finally {
        fs.closeSync(fd);
    }
}
