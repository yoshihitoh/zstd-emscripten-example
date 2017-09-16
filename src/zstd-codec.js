
export default class ZstdCodec {
    constructor() {
        // cwrapでJavaScriptから呼び出せるようにする
        this.zstd = require('./zstd.js');
        this.ZSTD_isError = this.zstd.cwrap('ZSTD_isError', 'number', ['number']);
        this.ZSTD_getFrameContentSize = this.zstd.cwrap('ZSTD_getFrameContentSize', 'number', ['array', 'number']);
        this.ZSTD_decompress = this.zstd.cwrap('ZSTD_decompress', 'number', ['number', 'number', 'array', 'number']);
    }

    /*
    withHeap(heap_size, action) {
        const heap = this.zstd._malloc(heap_size);
        try {
            return action(heap, heap_size);
        } finally {
            this.zstd._free(heap);
        }
    }

    decompress(zstd_bytes) {
        const content_size = this.getFrameContentSize(zstd_bytes);
        if (!content_size) return undefined;

        return this.withHeap(content_size, (heap) => {
            const decompress_rc = this.ZSTD_decompress(heap, content_size, zstd_bytes, zstd_bytes.length);
            return decompress_rc == content_size
                ? new Uint8Array(this.zstd.HEAPU8.buffer, heap, content_size)
                : undefined
                ;
        });
    }
    */

    isError(zstd_rc) {
        return this.ZSTD_isError(zstd_rc);
    }

    getFrameContentSize(zstd_bytes) {
        // 伸長後サイズ(単位:バイト)を取得する
        const content_size = this.ZSTD_getFrameContentSize(zstd_bytes, zstd_bytes.length);

        // Emscriptenの割り当てメモリはデフォルトで16MiBなので、
        // サンプルアプリケーションでは1MiBを超える場合はエラー扱いにする

        // NOTE: ZSTD_getFrameContentSizeのエラー値はnumber型で表現できない。
        // 厳密にエラーチェックする場合は、C言語のレイヤで判定するラッパー関数を用意すること
        const content_size_limit = 1 * 1024 * 1024;
        return content_size <= content_size_limit ? content_size : null;
    }

    decompress(zstd_bytes) {
        const content_size = this.getFrameContentSize(zstd_bytes);
        if (!content_size) return null;

        // (a) ヒープ領域を確保、伸張データの出力先として使用する
        const heap = this.zstd._malloc(content_size);
        try {
            // (b) 圧縮データを伸長する
            const decompress_rc = this.ZSTD_decompress(heap, content_size, zstd_bytes, zstd_bytes.length);
            if (this.isError(decompress_rc) || decompress_rc != content_size) return null;

            // (c) 伸長データをJavaScriptの配列にコピーする
            return new Uint8Array(this.zstd.HEAPU8.buffer, heap, content_size);
        } finally {
            // (d) 例外発生時に解放漏れしないようにする
            this.zstd._free(heap);
        }
    }
}
