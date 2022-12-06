// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as ref from "ref-napi";
import { ArrayType } from "./ref-array";
import { StructType } from "./ref-struct";
import { WORD, LONG, DWORD, ULONG, BYTE, ULONGLONG, sizeof } from "./win32";
import * as fs from "fs";

const IMAGE_DOS_SIGNATURE_LE = 0x5a4d;                                              // MZ (in little-endian)
const IMAGE_DOS_SIGNATURE_BE = 0x4d5a;                                              // MZ (in big-endian)
const IMAGE_DOS_SIGNATURE = ref.endianness === "LE" ? IMAGE_DOS_SIGNATURE_LE : IMAGE_DOS_SIGNATURE_BE;

const IMAGE_NT_SIGNATURE_LE = 0x00004550;                                           // PE00 (in little-endian)
const IMAGE_NT_SIGNATURE_BE = 0x50450000;                                           // PE00 (in big-endian)
const IMAGE_NT_SIGNATURE = ref.endianness === "LE" ? IMAGE_NT_SIGNATURE_LE : IMAGE_NT_SIGNATURE_BE;

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
export const IMAGE_OPTIONAL_HEADER32 = StructType({
    Magic:                          WORD as ref.Type<typeof IMAGE_NT_OPTIONAL_HDR32_MAGIC>,
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
export const IMAGE_OPTIONAL_HEADER64 = StructType({
    Magic:                          WORD as ref.Type<typeof IMAGE_NT_OPTIONAL_HDR64_MAGIC>,
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
export const IMAGE_NT_HEADERS64 = StructType({
    Signature:      DWORD,
    FileHeader:     IMAGE_FILE_HEADER,
    OptionalHeader: IMAGE_OPTIONAL_HEADER64,
});

export function getImageHeaders(file: string) {
    const fd = fs.openSync(file, fs.constants.O_RDONLY);
    try {
        let bytesRead: number;

        // read the DOS header
        const dos_header_size = sizeof(IMAGE_DOS_HEADER);
        const dos_header = IMAGE_DOS_HEADER();
        bytesRead = fs.readSync(fd, dos_header.ref(), { position: 0, length: dos_header_size });
        if (bytesRead !== dos_header_size || dos_header.e_magic !== IMAGE_DOS_SIGNATURE) {
            return undefined;
        }

        const nt_headers_offset = dos_header.e_lfanew;
        
        // read the NT header first as a 32-bit PE
        const nt_headers32_size = sizeof(IMAGE_NT_HEADERS32);
        const nt_headers32 = IMAGE_NT_HEADERS32();
        bytesRead = fs.readSync(fd, nt_headers32.ref(), { position: nt_headers_offset, length: nt_headers32_size });
        if (bytesRead === nt_headers32_size && nt_headers32.Signature === IMAGE_NT_SIGNATURE && nt_headers32.OptionalHeader.Magic === IMAGE_NT_OPTIONAL_HDR32_MAGIC) {
            return nt_headers32;
        }

        const nt_headers64_size = sizeof(IMAGE_NT_HEADERS64);
        const nt_headers64 = IMAGE_NT_HEADERS64();
        bytesRead = fs.readSync(fd, nt_headers64.ref(), { position: nt_headers_offset, length: nt_headers64_size });
        if (bytesRead === nt_headers64_size && nt_headers64.Signature === IMAGE_NT_SIGNATURE && nt_headers64.OptionalHeader.Magic === IMAGE_NT_OPTIONAL_HDR64_MAGIC) {
            return nt_headers64;
        }

        return undefined;
    }
    finally {
        fs.closeSync(fd);
    }
}
