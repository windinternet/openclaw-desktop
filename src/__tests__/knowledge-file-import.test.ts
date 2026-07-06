import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_IMPORT_ACCEPT, resolveKnowledgeImportFileKind } from '../lib/knowledge-file-import';

describe('knowledge file import', () => {
  it('classifies text files and extractable PDF/Office files for Knowledge imports', () => {
    expect(resolveKnowledgeImportFileKind({ name: 'notes.md', type: 'text/markdown' })).toEqual({
      kind: 'text',
      format: 'markdown',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'brief.txt', type: 'text/plain' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'customers.csv', type: '' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'exports.tsv', type: '' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'settings.json', type: 'application/json' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'events.jsonl', type: '' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'workflow.yaml', type: 'application/x-yaml' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'agent.yml', type: '' })).toEqual({
      kind: 'text',
      format: 'text',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'strategy.pdf', type: 'application/pdf' })).toEqual({
      kind: 'extractable',
      format: 'pdf',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'manual.docx', type: '' })).toEqual({
      kind: 'extractable',
      format: 'word',
    });
    expect(
      resolveKnowledgeImportFileKind({
        name: 'metrics.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ).toEqual({
      kind: 'extractable',
      format: 'excel',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'demo.pptx', type: '' })).toEqual({
      kind: 'extractable',
      format: 'powerpoint',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'diagram.svg', type: 'image/svg+xml' })).toEqual({
      kind: 'extractable',
      format: 'image',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'legacy-plan.doc', type: '' })).toEqual({
      kind: 'legacy-binary-office',
      format: 'word',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'legacy-budget.xls', type: 'application/vnd.ms-excel' })).toEqual({
      kind: 'legacy-binary-office',
      format: 'excel',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'legacy-demo.ppt', type: 'application/vnd.ms-powerpoint' })).toEqual({
      kind: 'legacy-binary-office',
      format: 'powerpoint',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'diagram.png', type: 'image/png' })).toEqual({
      kind: 'unavailable-extraction',
      format: 'image',
      reason: 'image-ocr-unavailable',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'meeting.m4a', type: 'audio/mp4' })).toEqual({
      kind: 'unavailable-extraction',
      format: 'audio',
      reason: 'audio-transcription-unavailable',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'demo.mp4', type: 'video/mp4' })).toEqual({
      kind: 'unavailable-extraction',
      format: 'video',
      reason: 'video-transcription-unavailable',
    });
    expect(resolveKnowledgeImportFileKind({ name: 'archive.zip', type: 'application/zip' })).toEqual({
      kind: 'unsupported',
    });
  });

  it('publishes a native file picker accept list for all supported Knowledge import files', () => {
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.md');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.txt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.csv');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tsv');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.json');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jsonl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.json5');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jsonc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.hjson');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ndjson');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jsonld');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.yaml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.yml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pdf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.docx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xlsx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pptx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.doc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xls');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ppt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/pdf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/msword');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/vnd.ms-excel');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/vnd.ms-powerpoint');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('image/*');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('audio/*');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('video/*');
  });

  it('keeps loose JSON and JSON Lines dialect files importable as raw text sources', () => {
    for (const name of ['settings.json5', 'config.jsonc', 'notes.hjson', 'events.ndjson', 'graph.jsonld']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(resolveKnowledgeImportFileKind({ name: 'graph', type: 'application/ld+json' })).toEqual({
      kind: 'text',
      format: 'text',
    });
  });

  it('keeps RDF and linked-data text serializations importable without graph parsing', () => {
    for (const name of ['catalog.ttl', 'terms.n3', 'facts.nt', 'dataset.nq', 'graph.trig', 'graph.trix']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ttl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.n3');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nq');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.trig');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.trix');
  });

  it('keeps version-control patch and metadata files importable as raw text sources', () => {
    for (const name of ['fix.patch', 'changes.diff', 'failed.rej', '.gitmodules', '.gitconfig', '.mailmap']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.patch');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.diff');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rej');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gitmodules');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gitconfig');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mailmap');
  });

  it('keeps VCS ignore and placeholder marker files importable as raw text sources', () => {
    for (const name of ['.git-blame-ignore-revs', '.gitkeep', '.keep', '.hgignore', '.svnignore', '.cvsignore']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.git-blame-ignore-revs');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gitkeep');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.keep');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.hgignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.svnignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cvsignore');
  });

  it('keeps additional raster image extensions importable as unavailable OCR sources', () => {
    for (const name of [
      'scan.bmp',
      'receipt.tif',
      'diagram.tiff',
      'mockup.avif',
      'photo.jpe',
      'camera.jfif',
      'portrait.heif',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'image',
        reason: 'image-ocr-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.bmp');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tif');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tiff');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.avif');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jpe');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jfif');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.heif');
  });

  it('keeps design, icon and camera raw image extensions importable as unavailable OCR sources', () => {
    for (const name of [
      'favicon.ico',
      'app-icon.icns',
      'mockup.psd',
      'large-layout.psb',
      'camera.raw',
      'capture.cr2',
      'capture.nef',
      'capture.arw',
      'negative.dng',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'image',
        reason: 'image-ocr-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ico');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.icns');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.psd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.psb');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.raw');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cr2');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nef');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.arw');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dng');
  });

  it('keeps additional vendor camera raw extensions importable as unavailable OCR sources', () => {
    for (const name of [
      'canon.cr3',
      'olympus.orf',
      'panasonic.rw2',
      'fujifilm.raf',
      'pentax.pef',
      'samsung.srw',
      'sigma.x3f',
      'epson.erf',
      'leaf.mos',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'image',
        reason: 'image-ocr-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cr3');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.orf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rw2');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.raf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pef');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.srw');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.x3f');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.erf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mos');
  });

  it('keeps vector and product design source extensions importable as unavailable OCR sources', () => {
    for (const name of [
      'brand.ai',
      'poster.eps',
      'packaging.cdr',
      'interface.sketch',
      'prototype.fig',
      'wireframe.xd',
      'illustration.afdesign',
      'brochure.indd',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'image',
        reason: 'image-ocr-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ai');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.eps');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cdr');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sketch');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.fig');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.afdesign');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.indd');
  });

  it('keeps vector and product design MIME types importable as unavailable OCR sources', () => {
    for (const type of [
      'application/postscript',
      'application/eps',
      'application/illustrator',
      'application/vnd.sketch',
      'application/x-figma',
      'application/vnd.adobe.xd',
      'application/x-indesign',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name: 'design-source', type })).toEqual({
        kind: 'unavailable-extraction',
        format: 'image',
        reason: 'image-ocr-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/postscript');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/eps');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/illustrator');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/vnd.sketch');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-figma');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/vnd.adobe.xd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-indesign');
  });

  it('keeps additional audio and video extensions importable as unavailable transcription sources', () => {
    for (const name of ['interview.flac', 'voice.opus', 'mix.aiff', 'memo.wma', 'call.amr', 'clip.oga']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'audio',
        reason: 'audio-transcription-unavailable',
      });
    }

    for (const name of [
      'recording.mkv',
      'demo.avi',
      'clip.m4v',
      'walkthrough.mpeg',
      'camera.mpg',
      'screen.ogv',
      'mobile.3gp',
      'archive.3g2',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'video',
        reason: 'video-transcription-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.flac');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.opus');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.aiff');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.wma');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.amr');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.oga');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mkv');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.avi');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.m4v');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mpeg');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mpg');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ogv');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.3gp');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.3g2');
  });

  it('keeps legacy audio and video container extensions importable as unavailable transcription sources', () => {
    for (const name of ['theme.mid', 'score.midi', 'archive.mka']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'audio',
        reason: 'audio-transcription-unavailable',
      });
    }

    for (const name of ['screen.wmv', 'clip.flv']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'video',
        reason: 'video-transcription-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mid');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.midi');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mka');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.wmv');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.flv');
  });

  it('keeps older broadcast audio and video containers importable as unavailable transcription sources', () => {
    for (const name of ['voice.ra', 'playlist.ram', 'sample.au', 'alert.snd', 'recording.caf']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'audio',
        reason: 'audio-transcription-unavailable',
      });
    }

    for (const name of ['lecture.asf', 'archive.rm', 'movie.rmvb', 'disc.vob', 'camera.m2ts']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'unavailable-extraction',
        format: 'video',
        reason: 'video-transcription-unavailable',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ra');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ram');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.au');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.snd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.caf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.asf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rm');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rmvb');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vob');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.m2ts');
  });

  it('keeps common text-like extensions importable when MIME metadata is missing', () => {
    expect(resolveKnowledgeImportFileKind({ name: 'component.mdx', type: '' })).toEqual({
      kind: 'text',
      format: 'markdown',
    });

    for (const name of [
      'debug.log',
      'snapshot.html',
      'archive.htm',
      'feed.xml',
      'notes.rtf',
      'guide.rst',
      'runbook.adoc',
      'manual.asciidoc',
      'meeting.srt',
      'captions.vtt',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    for (const type of ['application/rtf', 'text/rtf']) {
      expect(resolveKnowledgeImportFileKind({ name: 'notes', type })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mdx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.log');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.html');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.htm');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rtf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rst');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.adoc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.asciidoc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.srt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vtt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/rtf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/rtf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/x-rst');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/asciidoc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/vtt');
  });

  it('keeps academic and lightweight markup source files importable without rendering them', () => {
    for (const name of [
      'paper.tex',
      'notes.latex',
      'tasks.org',
      'article.textile',
      'page.creole',
      'legacy.mediawiki',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tex');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.latex');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.org');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.textile');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.creole');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mediawiki');
  });

  it('keeps documentation and help-system markup source files importable without rendering them', () => {
    for (const name of ['manual.texi', 'guide.texinfo', 'module.pod', 'api.rdoc', 'page.wiki', 'notes.dokuwiki']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.texi');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.texinfo');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pod');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rdoc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.wiki');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dokuwiki');
  });

  it('keeps environment and build configuration filenames importable as text sources', () => {
    for (const name of [
      '.env',
      '.env.local',
      '.dockerignore',
      '.gitignore',
      '.npmrc',
      'Dockerfile',
      'Containerfile',
      'Makefile',
      'Procfile',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.env');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dockerignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gitignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.npmrc');
  });

  it('keeps repository config and lock filenames importable as text sources', () => {
    for (const name of [
      '.editorconfig',
      '.prettierrc',
      '.eslintrc',
      '.stylelintrc',
      '.babelrc',
      '.npmignore',
      '.gitattributes',
      'yarn.lock',
      'Cargo.lock',
      'Gemfile',
      'Pipfile',
      'Brewfile',
      'Justfile',
      'Taskfile',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.editorconfig');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.prettierrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.eslintrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.stylelintrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.babelrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.npmignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gitattributes');
  });

  it('keeps package and build manifest filenames importable as text sources', () => {
    for (const name of [
      'go.mod',
      'go.sum',
      'go.work',
      'build.gradle',
      'settings.gradle',
      'BUILD',
      'WORKSPACE',
      'BUILD.bazel',
      'MODULE.bazel',
      'workspace.bzl',
      'flake.nix',
      'default.nix',
      'shell.nix',
      'mix.exs',
      'mix.lock',
      'meson.build',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sum');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.work');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gradle');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.bazel');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.bzl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nix');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.exs');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.build');
  });

  it('keeps project build and packaging configuration filenames importable as text sources', () => {
    for (const name of [
      'CMakeLists.txt',
      'CMakePresets.json',
      'meson.options',
      'pyproject.toml',
      'setup.cfg',
      'tox.ini',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('CMakeLists.txt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('CMakePresets.json');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('meson.options');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('pyproject.toml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('setup.cfg');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('tox.ini');
  });

  it('keeps additional build tool entrypoint filenames importable as text sources', () => {
    for (const name of ['SConstruct', 'SConscript', 'BUCK', 'TARGETS', 'BUILD.gn', 'build.ninja']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('SConstruct');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('SConscript');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('BUCK');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('TARGETS');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gn');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ninja');
  });

  it('keeps extensionless repository documentation filenames importable as text sources', () => {
    for (const name of [
      'README',
      'LICENSE',
      'NOTICE',
      'CHANGELOG',
      'CONTRIBUTING',
      'CODEOWNERS',
      'MAINTAINERS',
      'AUTHORS',
      'COPYING',
      'SECURITY',
      'SUPPORT',
      'CODE_OF_CONDUCT',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }
  });

  it('keeps runtime version and toolchain selector filenames importable as text sources', () => {
    for (const name of [
      '.nvmrc',
      '.node-version',
      '.python-version',
      '.ruby-version',
      '.java-version',
      '.go-version',
      '.terraform-version',
      '.tool-versions',
      '.sdkmanrc',
      '.envrc',
      'rust-toolchain',
      'rust-toolchain.toml',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nvmrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.node-version');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.python-version');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tool-versions');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sdkmanrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.envrc');
  });

  it('keeps extensionless tool, CI and infrastructure entrypoint filenames importable as text sources', () => {
    for (const name of [
      'Jenkinsfile',
      'Caddyfile',
      'Vagrantfile',
      'Rakefile',
      'Cakefile',
      'Guardfile',
      'Fastfile',
      'Appfile',
      'Deliverfile',
      'Matchfile',
      'Dangerfile',
      'Earthfile',
      'Tiltfile',
      'Snakefile',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }
  });

  it('keeps frontend and release tooling dotfiles importable as text sources', () => {
    for (const name of [
      '.browserslistrc',
      '.commitlintrc',
      '.lintstagedrc',
      '.releaserc',
      '.remarkrc',
      '.swcrc',
      '.parcelrc',
      '.postcssrc',
      '.vuerc',
      '.sentryclirc',
      '.firebaserc',
      '.eslintignore',
      '.prettierignore',
      '.stylelintignore',
      '.vercelignore',
      '.slugignore',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.browserslistrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.commitlintrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.lintstagedrc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.releaserc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.eslintignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.prettierignore');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.stylelintignore');
  });

  it('keeps common config-like text files importable without parsing configuration structure', () => {
    for (const name of ['settings.toml', 'service.ini', 'nginx.conf', 'app.properties']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    for (const type of ['application/toml', 'application/x-toml']) {
      expect(resolveKnowledgeImportFileKind({ name: 'config', type })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.toml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ini');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.conf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.properties');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/toml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-toml');
  });

  it('keeps common code and query text files importable without executing or validating them', () => {
    for (const name of ['schema.sql', 'query.graphql', 'fragment.gql', 'events.proto']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(resolveKnowledgeImportFileKind({ name: 'query', type: 'application/graphql' })).toEqual({
      kind: 'text',
      format: 'text',
    });

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sql');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.graphql');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gql');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.proto');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/graphql');
  });

  it('keeps infrastructure as code and declarative configuration files importable without executing tools', () => {
    for (const name of [
      'main.tf',
      'production.tfvars',
      'terragrunt.hcl',
      'deploy.nomad',
      'policy.cue',
      'config.dhall',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tfvars');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.hcl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nomad');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cue');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dhall');
  });

  it('keeps policy and configuration template DSL files importable without evaluating them', () => {
    for (const name of [
      'policy.rego',
      'service.jsonnet',
      'library.libsonnet',
      'build.star',
      'values.gotmpl',
      'overlay.ytt',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rego');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jsonnet');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.libsonnet');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.star');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gotmpl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ytt');
  });

  it('keeps data science notebook and analysis source files importable without running kernels', () => {
    for (const name of ['analysis.ipynb', 'report.rmd', 'paper.qmd', 'model.jl', 'matrix.m', 'survey.do']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ipynb');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rmd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.qmd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.m');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.do');
  });

  it('keeps diagram and architecture source files importable without rendering them', () => {
    for (const name of [
      'architecture.drawio',
      'sequence.puml',
      'flow.plantuml',
      'decision.mermaid',
      'journey.mmd',
      'dependency.dot',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.drawio');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.puml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.plantuml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mermaid');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mmd');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dot');
  });

  it('keeps subtitle and transcript sidecar files importable without transcribing media', () => {
    for (const name of ['captions.ass', 'legacy.ssa', 'timed-text.ttml', 'broadcast.dfxp', 'youtube.sbv']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ass');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ssa');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ttml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.dfxp');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sbv');
  });

  it('keeps timed text and lyric sidecar files importable without parsing media timelines', () => {
    for (const name of ['archive.smi', 'legacy.sami', 'universal.usf', 'apple.itt', 'captions.scc', 'lyrics.lrc']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.smi');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sami');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.usf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.itt');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.scc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.lrc');
  });

  it('keeps localization and translation resource files importable without applying translations', () => {
    for (const name of [
      'messages.po',
      'template.pot',
      'app_en.arb',
      'Localizable.strings',
      'Resources.resx',
      'strings.xliff',
      'legacy.xlf',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.po');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.pot');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.arb');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.strings');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.resx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xliff');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xlf');
  });

  it('keeps calendar contact and message export files importable without taking actions on them', () => {
    for (const name of [
      'calendar.ics',
      'legacy.ical',
      'contacts.vcf',
      'address-book.vcard',
      'thread.eml',
      'archive.mbox',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ics');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ical');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vcf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vcard');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.eml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mbox');
  });

  it('keeps outline feed and XHTML export files importable without subscribing or fetching', () => {
    for (const name of ['subscriptions.opml', 'feed.rss', 'archive.atom', 'catalog.rdf', 'page.xhtml', 'legacy.xht']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.opml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rss');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.atom');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.rdf');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xhtml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.xht');
  });

  it('keeps bookmark shortcut and web capture metadata files importable without opening links', () => {
    for (const name of [
      'saved.url',
      'reading-list.webloc',
      'location.inetloc',
      'site.webmanifest',
      'network.har',
      'launcher.desktop',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.url');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.webloc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.inetloc');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.webmanifest');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.har');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.desktop');
  });

  it('keeps bibliography and citation metadata files importable without resolving references', () => {
    for (const name of ['references.bib', 'export.ris', 'library.enw', 'pubmed.nbib', 'style.csl', 'citation.cff']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.bib');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ris');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.enw');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.nbib');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.csl');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cff');
  });

  it('keeps geospatial and route metadata files importable without rendering maps', () => {
    for (const name of ['track.gpx', 'places.kml', 'boundary.geojson', 'tiles.topojson', 'extract.osm', 'ride.tcx']) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.gpx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.kml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.geojson');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.topojson');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.osm');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tcx');
  });

  it('keeps security scan SBOM and license report files importable without making compliance decisions', () => {
    for (const name of [
      'codeql.sarif',
      'packages.spdx',
      'bom.cdx',
      'scan.scancode',
      'exploitability.vex',
      'advisory.csaf',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sarif');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.spdx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cdx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.scancode');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vex');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.csaf');
  });

  it('keeps common source code and shell script files importable without executing or compiling them', () => {
    for (const name of [
      'app.js',
      'component.jsx',
      'model.ts',
      'screen.tsx',
      'styles.css',
      'theme.scss',
      'tokens.less',
      'worker.py',
      'deploy.sh',
      'profile.bash',
      'hooks.zsh',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    for (const type of [
      'application/javascript',
      'application/x-javascript',
      'text/javascript',
      'text/x-python',
      'application/x-sh',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name: 'source', type })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.js');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.jsx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.ts');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.tsx');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.css');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.scss');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.less');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.py');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.sh');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.bash');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.zsh');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/javascript');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-javascript');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/javascript');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('text/x-python');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-sh');
  });

  it('keeps modern frontend module and component source files importable without executing them', () => {
    for (const name of [
      'vite.config.mjs',
      'postcss.config.cjs',
      'router.mts',
      'legacy-types.cts',
      'App.vue',
      'Widget.svelte',
      'landing.astro',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mjs');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cjs');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.mts');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.cts');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.vue');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.svelte');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('.astro');
  });

  it('keeps broader source language files importable as inert text sources', () => {
    for (const name of [
      'service.go',
      'engine.rs',
      'Controller.java',
      'native.c',
      'native.h',
      'renderer.cpp',
      'renderer.cc',
      'renderer.cxx',
      'renderer.hpp',
      'Api.cs',
      'plugin.php',
      'task.rb',
      'Client.swift',
      'Screen.kt',
      'script.kts',
      'Job.scala',
      'analysis.r',
      'filter.lua',
      'widget.dart',
    ]) {
      expect(resolveKnowledgeImportFileKind({ name, type: '' })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    for (const type of ['application/x-php', 'application/x-ruby', 'application/dart']) {
      expect(resolveKnowledgeImportFileKind({ name: 'source', type })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    for (const extension of [
      '.go',
      '.rs',
      '.java',
      '.c',
      '.h',
      '.cpp',
      '.cc',
      '.cxx',
      '.hpp',
      '.cs',
      '.php',
      '.rb',
      '.swift',
      '.kt',
      '.kts',
      '.scala',
      '.r',
      '.lua',
      '.dart',
    ]) {
      expect(KNOWLEDGE_IMPORT_ACCEPT).toContain(extension);
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-php');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/x-ruby');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/dart');
  });

  it('keeps XML family MIME types importable when filename extensions are missing', () => {
    for (const type of ['application/xml', 'application/rss+xml', 'application/atom+xml', 'application/xhtml+xml']) {
      expect(resolveKnowledgeImportFileKind({ name: 'export', type })).toEqual({
        kind: 'text',
        format: 'text',
      });
    }

    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/xml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/rss+xml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/atom+xml');
    expect(KNOWLEDGE_IMPORT_ACCEPT).toContain('application/xhtml+xml');
  });
});
