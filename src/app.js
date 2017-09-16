import React from 'react';
import {render} from 'react-dom';
import Dropzone from 'react-dropzone';
import {Chip, Spinner} from 'react-mdl';
import {PrismCode} from 'react-prism';

import ZstdCodec from './zstd-codec.js';


// TODO: react-mdlのコンポーネントに入れ替える


function as_int(value) {
    return (+value) | 0;
}


function as_decimal(value, precision) {
    precision = precision >= 0 ? precision : 0;

    const multiplier = Math.pow(10, precision);
    return ((as_int(value * multiplier)) / multiplier).toFixed(precision);
}


class NumberFormatter {
    constructor(label, unit_size) {
        this.label = label;
        this.unit_size = unit_size;
    }

    format(size, precision) {
        const converted_size = this.convert_size(size, precision);
        return converted_size + this.label;
    }

    convert_size(size, precision = 2) {
        return as_decimal(+size / this.unit_size, precision);
    }
}


function find_formatter_for(size) {
    const formatters = [
        new NumberFormatter('B', 1),
        new NumberFormatter('KiB', 1 * 1024),
        new NumberFormatter('MiB', 1 * 1024 * 1024)
    ];

    formatters.sort((a, b) => { return a.unit_size < b.unit_size });
    return formatters.find((x) => as_int(x.convert_size(size, 2)) > 0);
}


function human_size(size, unit_formatter) {
    unit_formatter = unit_formatter || find_formatter_for(size);
    return unit_formatter.format(size);
}


function getImageContentTypes() {
    return {
        'bmp':  'bmp',  // BMP
        'gif':  'gif',  // GIF
        'png':  'png',  // PNG
        'jpg':  'jpeg', // JPG
        'jpeg': 'jpeg'  // JPG
    };
}


function getCodeContentTypes() {
    return {
        'c':    'c',    'cc': 'cpp',    'cpp': 'cpp', 'cxx': 'cpp', // C/C++ (ソース)
        'h':    'cpp',  'hh': 'cpp',    'hpp': 'cpp', 'hxx': 'cpp', // C/C++ (ヘッダ)
        'htm':  'html', 'html': 'html', // HTML
        'css':  'css',                  // CSS
        'js':   'javascript',           // JavaScript
        'json': 'json'                  // JSON
    };
}


function isImageContent(content_type) {
    const image_types = new Set(Object.values(getImageContentTypes()));
    return image_types.has(content_type);
}


function isCodeContent(content_type) {
    const code_types = new Set(Object.values(getCodeContentTypes()));
    return code_types.has(content_type);
}


class AppHeader extends React.Component {
    render() {
        return <header className="mdl-layout__header">
            <span className="mdl-layout__header-row">Zstandard Library on Browser</span>
            <div className="mdl-layout-spacer" />
        </header>;
    }
}


class FileSummary extends React.Component {
    constructor(props) {
        super(props);
    }

    file_name(getter) {
        return getter().name || '(no file)';
    }

    file_size(getter) {
        const size = getter().size;
        return size ? human_size(size) : '-';
    }

    compressed() { return this.props.fileInfo.compressed; }
    compressed_name() { return this.file_name(this.compressed.bind(this)); }
    compressed_size() { return this.file_size(this.compressed.bind(this)); }
    compression_rate() {
        const original = as_int(this.original().size);
        const compressed = as_int(this.compressed().size);
        if (original === 0) return '';

        return as_decimal(100 * compressed / original, 2) + '%';
    }

    original() { return this.props.fileInfo.original; }
    original_name() { return this.file_name(this.original.bind(this)); }
    original_size() { return this.file_size(this.original.bind(this)); }

    render() {
        return <div className="mdl-card app-file-info">
            <div className="mdl-card__title">
            <h4 className="mdl-card__title-text">{ this.compressed_name() }</h4>
            </div>
            <div className="mdl-card__supporting-text">
                <div className="mdl-grid app-file-info-grid">
                    <div className="mdl-cell mdl-cell--4-col">compressed:</div>
                    <div className="mdl-cell mdl-cell--3-col app-file-size">{ this.compressed_size() }</div>
                    <div className="mdl-cell mdl-cell--2-col">{ this.compression_rate() }</div>
                </div>
                <div className="mdl-grid app-file-info-grid">
                    <div className="mdl-cell mdl-cell--4-col">original:</div>
                    <div className="mdl-cell mdl-cell--3-col app-file-size">{ this.original_size() }</div>
                </div>
            </div>
        </div>;
    }
}


class ContentView extends React.Component {
    constructor(props) {
        super(props);

        this.state = { loading: false, view: <p>File Contents Here</p> };
    }

    render() {
        const items = [];

        const content_name = this.props.contentName;
        if (content_name) {
            items.push(<div className="mdl-grid">
                <Chip>{content_name}</Chip>
            </div>);
        }

        items.push(<div className="mdl-grid">{this.state.view}</div>);
        return <div>{items}</div>;
    }

    componentWillReceiveProps(nextProps) {
        // ロード中はビューの作成中なので何もしない
        if (this.isBusy()) return;

        // 種別未決定→表示データなし
        const content = {
            type: nextProps.contentType,
            name: nextProps.contentName,
            bytes: nextProps.contentBytes
        };

        if (!content.type) {
            this.updateView(<p>File Contents Here</p>);
            return;
        }

        if (content.bytes) {
            if (!this.isBusy()) {
                this.setBusy(true);
                // 実際のビューを作成する
                new Promise((resolve, reject) => {
                    setTimeout(() => {resolve(this.createContentView(content));}, 1500);
                    //resolve(this.createContentView(content));
                }).then((view) => {
                    this.updateView(view);
                    this.setBusy(false);
                });
            }
        }
        else {
            this.updateView(this.createLoadingView());
        }
    }

    updateView(view) {
        this.setState({ view: view });
    }

    isBusy() {
        this.state.busy;
    }

    setBusy(busy) {
        this.setState({ busy: busy });
    }

    createLoadingView() {
        return <Spinner />;
    }

    createContentView(content) {
        if (isImageContent(content.type)) {
            const img_src = 'data:image/' + content.type + ';base64,' + this.toBase64(content.bytes);
            const img = <img className="app-content-image" src={img_src} />
            return <div className="app-content-image-container">{img}</div>;
        }
        else if (isCodeContent(content.type)) {
            const code_text = this.toUtf8(content.bytes);
            const className = "language-" +content.type;
            // return <PrismCode className={className}>{code_text}</PrismCode>;
            return <pre className="line-numbers">
                <PrismCode className={className}>
                    {code_text}
                </PrismCode>
            </pre>;
        }

        return <p>TODO: content view</p>;
    }

    toBase64(content_bytes) {
        return new Buffer(content_bytes).toString('base64');
    }

    toUtf8(content_bytes) {
        return new Buffer(content_bytes).toString('utf8');
    }
}


class AppMain extends React.Component {
    constructor(props) {
        super(props);

        this.zstd_codec = new ZstdCodec();
        this.state = {
            fileInfo: {
                compressed: {},
                original:   {}
            },
            content: {
                type: null,
                bytes: []
            }
        };
    }

    updateState(content_type, compressed, original) {
        this.setState({
            fileInfo: { compressed: compressed, original, original },
            content_type: content_type
        });
    }

    getContentTypeByExt(file_ext) {
        const content_types = Object.assign(getImageContentTypes(), getCodeContentTypes());
        return content_types[file_ext] || file_ext;
    }

    onDrop(files) {
        if (files.length == 0) return;

        // 非圧縮データのみ即時表示する。展開およびビューは非同期で処理
        const dropped_file = files[0];

        const original_name = dropped_file.name.replace('.zst', '');
        const original = { name: original_name, size: null, bytes: null};
        const compressed = { name: dropped_file.name, size: dropped_file.size, bytes: null};
        const content_type = this.getContentTypeByExt(original_name.split('.').pop());

        this.updateState(content_type, compressed, original);

        const reader = new FileReader();
        reader.onload = () => {
            // 圧縮データを展開する
            const compressed_bytes = new Uint8Array(reader.result, 0, reader.result.byteLength);
            const original_bytes = this.zstd_codec.decompress(compressed_bytes);
            const original = { name: original_name, size: original_bytes.length, bytes: original_bytes };

            this.updateState(content_type, compressed, original);
        };

        reader.readAsArrayBuffer(dropped_file);
    }

    render() {
        return <main className="mdl-layout__content">
            <div className="page-content">
                <section className="mdl-grid mdl-shadow--2dp app-file-info">
                    <div className="mdl-cell mdl-cell--2-col app-dropzone-container">
                        <Dropzone className="app-dropzone" onDrop={this.onDrop.bind(this)} accept=".zst">
                            drop .zst file here
                        </Dropzone>
                    </div>
                    <div className="mdl-cell mdl-cell--4-col">
                        <FileSummary fileInfo={this.state.fileInfo}/>
                    </div>
                </section>
                <section className="mdl-grid app-content-view">
                    <div className="mdl-cell mdl-cell--12-col app-content-view-container">
                        <ContentView contentType={this.state.content_type}
                                     contentName={this.state.fileInfo.original.name}
                                     contentBytes={this.state.fileInfo.original.bytes} />
                    </div>
                </section>
            </div>
        </main>;
    }
}


export default class App extends React.Component {
    render() {
        return <div className="mdl-layout mdl-js-layout mdl-layout--fixed-header ems-example">
            <AppHeader />
            <AppMain />
        </div>;
    }
}


render(
    <App />, document.getElementById('app')
);

