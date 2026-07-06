export type KnowledgeExtractedFileFormat = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'image' | 'audio' | 'video';

export type KnowledgeUnavailableExtractionReason =
  | 'legacy-binary-office'
  | 'image-ocr-unavailable'
  | 'audio-transcription-unavailable'
  | 'video-transcription-unavailable';

export type KnowledgeImportFileKind =
  | { kind: 'text'; format: 'markdown' | 'text' }
  | { kind: 'extractable'; format: KnowledgeExtractedFileFormat }
  | { kind: 'legacy-binary-office'; format: 'word' | 'excel' | 'powerpoint' }
  | {
      kind: 'unavailable-extraction';
      format: 'image' | 'audio' | 'video';
      reason: Exclude<KnowledgeUnavailableExtractionReason, 'legacy-binary-office'>;
    }
  | { kind: 'unsupported' };

export interface KnowledgeImportFileLike {
  name: string;
  type?: string;
}

export const KNOWLEDGE_IMPORT_ACCEPT = [
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.log',
  '.patch',
  '.diff',
  '.rej',
  '.csv',
  '.tsv',
  '.json',
  '.jsonl',
  '.json5',
  '.jsonc',
  '.hjson',
  '.ndjson',
  '.jsonld',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.properties',
  '.env',
  '.editorconfig',
  '.dockerignore',
  '.gitignore',
  '.git-blame-ignore-revs',
  '.gitmodules',
  '.gitconfig',
  '.npmrc',
  '.prettierrc',
  '.eslintrc',
  '.stylelintrc',
  '.babelrc',
  '.npmignore',
  '.gitattributes',
  '.mailmap',
  '.gitkeep',
  '.keep',
  '.hgignore',
  '.svnignore',
  '.cvsignore',
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
  '.lock',
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
  '.sum',
  '.work',
  'CMakeLists.txt',
  'CMakePresets.json',
  'meson.options',
  'pyproject.toml',
  'setup.cfg',
  'tox.ini',
  'SConstruct',
  'SConscript',
  'BUCK',
  'TARGETS',
  '.gn',
  '.gni',
  '.ninja',
  '.gradle',
  '.bazel',
  '.bzl',
  '.nix',
  '.exs',
  '.build',
  '.sql',
  '.graphql',
  '.gql',
  '.proto',
  '.tf',
  '.tfvars',
  '.hcl',
  '.nomad',
  '.cue',
  '.dhall',
  '.rego',
  '.jsonnet',
  '.libsonnet',
  '.star',
  '.gotmpl',
  '.ytt',
  '.ipynb',
  '.rmd',
  '.qmd',
  '.jl',
  '.m',
  '.do',
  '.drawio',
  '.puml',
  '.plantuml',
  '.mermaid',
  '.mmd',
  '.dot',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.css',
  '.scss',
  '.less',
  '.vue',
  '.svelte',
  '.astro',
  '.py',
  '.sh',
  '.bash',
  '.zsh',
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
  '.html',
  '.htm',
  '.xml',
  '.opml',
  '.rss',
  '.atom',
  '.rdf',
  '.ttl',
  '.n3',
  '.nt',
  '.nq',
  '.trig',
  '.trix',
  '.xhtml',
  '.xht',
  '.url',
  '.webloc',
  '.inetloc',
  '.webmanifest',
  '.har',
  '.desktop',
  '.bib',
  '.ris',
  '.enw',
  '.nbib',
  '.csl',
  '.cff',
  '.gpx',
  '.kml',
  '.geojson',
  '.topojson',
  '.osm',
  '.tcx',
  '.sarif',
  '.spdx',
  '.cdx',
  '.scancode',
  '.vex',
  '.csaf',
  '.rtf',
  '.rst',
  '.adoc',
  '.asciidoc',
  '.tex',
  '.latex',
  '.org',
  '.textile',
  '.creole',
  '.mediawiki',
  '.texi',
  '.texinfo',
  '.pod',
  '.rdoc',
  '.wiki',
  '.dokuwiki',
  '.srt',
  '.vtt',
  '.ass',
  '.ssa',
  '.ttml',
  '.dfxp',
  '.sbv',
  '.smi',
  '.sami',
  '.usf',
  '.itt',
  '.scc',
  '.lrc',
  '.po',
  '.pot',
  '.arb',
  '.strings',
  '.resx',
  '.xliff',
  '.xlf',
  '.ics',
  '.ical',
  '.vcf',
  '.vcard',
  '.eml',
  '.mbox',
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.png',
  '.jpg',
  '.jpeg',
  '.jpe',
  '.jfif',
  '.bmp',
  '.tif',
  '.tiff',
  '.webp',
  '.avif',
  '.gif',
  '.heic',
  '.heif',
  '.ico',
  '.icns',
  '.psd',
  '.psb',
  '.raw',
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
  '.dng',
  '.orf',
  '.rw2',
  '.raf',
  '.pef',
  '.srw',
  '.x3f',
  '.erf',
  '.mos',
  '.ai',
  '.eps',
  '.cdr',
  '.sketch',
  '.fig',
  '.xd',
  '.afdesign',
  '.indd',
  '.svg',
  '.mp3',
  '.m4a',
  '.wav',
  '.aac',
  '.ogg',
  '.flac',
  '.opus',
  '.aiff',
  '.wma',
  '.amr',
  '.oga',
  '.mid',
  '.midi',
  '.mka',
  '.ra',
  '.ram',
  '.au',
  '.snd',
  '.caf',
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.m4v',
  '.mpeg',
  '.mpg',
  '.ogv',
  '.3gp',
  '.3g2',
  '.wmv',
  '.flv',
  '.asf',
  '.rm',
  '.rmvb',
  '.vob',
  '.m2ts',
  'text/markdown',
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'application/ld+json',
  'application/x-ndjson',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'application/toml',
  'application/x-toml',
  'application/graphql',
  'application/javascript',
  'application/x-javascript',
  'text/javascript',
  'text/x-python',
  'application/x-sh',
  'application/x-php',
  'application/x-ruby',
  'application/dart',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/xhtml+xml',
  'application/rtf',
  'text/rtf',
  'text/x-rst',
  'text/asciidoc',
  'text/vtt',
  'application/postscript',
  'application/eps',
  'application/illustrator',
  'application/vnd.sketch',
  'application/x-figma',
  'application/vnd.adobe.xd',
  'application/x-indesign',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'image/*',
  'audio/*',
  'video/*',
].join(',');

export function resolveKnowledgeImportFileKind(file: KnowledgeImportFileLike): KnowledgeImportFileKind {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type ?? '').toLowerCase();

  if (
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown') ||
    lowerName.endsWith('.mdx') ||
    lowerType === 'text/markdown'
  ) {
    return { kind: 'text', format: 'markdown' };
  }
  if (
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.log') ||
    lowerName.endsWith('.patch') ||
    lowerName.endsWith('.diff') ||
    lowerName.endsWith('.rej') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.jsonl') ||
    lowerName.endsWith('.json5') ||
    lowerName.endsWith('.jsonc') ||
    lowerName.endsWith('.hjson') ||
    lowerName.endsWith('.ndjson') ||
    lowerName.endsWith('.jsonld') ||
    lowerName.endsWith('.yaml') ||
    lowerName.endsWith('.yml') ||
    lowerName.endsWith('.toml') ||
    lowerName.endsWith('.ini') ||
    lowerName.endsWith('.conf') ||
    lowerName.endsWith('.properties') ||
    lowerName === '.env' ||
    lowerName.startsWith('.env.') ||
    lowerName.endsWith('.editorconfig') ||
    lowerName.endsWith('.dockerignore') ||
    lowerName.endsWith('.gitignore') ||
    lowerName.endsWith('.git-blame-ignore-revs') ||
    lowerName.endsWith('.gitmodules') ||
    lowerName.endsWith('.gitconfig') ||
    lowerName.endsWith('.npmrc') ||
    lowerName.endsWith('.prettierrc') ||
    lowerName.endsWith('.eslintrc') ||
    lowerName.endsWith('.stylelintrc') ||
    lowerName.endsWith('.babelrc') ||
    lowerName.endsWith('.npmignore') ||
    lowerName.endsWith('.gitattributes') ||
    lowerName.endsWith('.mailmap') ||
    lowerName.endsWith('.gitkeep') ||
    lowerName.endsWith('.keep') ||
    lowerName.endsWith('.hgignore') ||
    lowerName.endsWith('.svnignore') ||
    lowerName.endsWith('.cvsignore') ||
    lowerName.endsWith('.browserslistrc') ||
    lowerName.endsWith('.commitlintrc') ||
    lowerName.endsWith('.lintstagedrc') ||
    lowerName.endsWith('.releaserc') ||
    lowerName.endsWith('.remarkrc') ||
    lowerName.endsWith('.swcrc') ||
    lowerName.endsWith('.parcelrc') ||
    lowerName.endsWith('.postcssrc') ||
    lowerName.endsWith('.vuerc') ||
    lowerName.endsWith('.sentryclirc') ||
    lowerName.endsWith('.firebaserc') ||
    lowerName.endsWith('.eslintignore') ||
    lowerName.endsWith('.prettierignore') ||
    lowerName.endsWith('.stylelintignore') ||
    lowerName.endsWith('.vercelignore') ||
    lowerName.endsWith('.slugignore') ||
    lowerName.endsWith('.lock') ||
    lowerName.endsWith('.nvmrc') ||
    lowerName.endsWith('.node-version') ||
    lowerName.endsWith('.python-version') ||
    lowerName.endsWith('.ruby-version') ||
    lowerName.endsWith('.java-version') ||
    lowerName.endsWith('.go-version') ||
    lowerName.endsWith('.terraform-version') ||
    lowerName.endsWith('.tool-versions') ||
    lowerName.endsWith('.sdkmanrc') ||
    lowerName.endsWith('.envrc') ||
    lowerName.endsWith('.sum') ||
    lowerName.endsWith('.work') ||
    lowerName.endsWith('.gn') ||
    lowerName.endsWith('.gni') ||
    lowerName.endsWith('.ninja') ||
    lowerName.endsWith('.gradle') ||
    lowerName.endsWith('.bazel') ||
    lowerName.endsWith('.bzl') ||
    lowerName.endsWith('.nix') ||
    lowerName.endsWith('.exs') ||
    lowerName.endsWith('.build') ||
    [
      'dockerfile',
      'containerfile',
      'makefile',
      'procfile',
      'gemfile',
      'pipfile',
      'brewfile',
      'justfile',
      'taskfile',
      'go.mod',
      'cmakelists.txt',
      'cmakepresets.json',
      'meson.options',
      'pyproject.toml',
      'setup.cfg',
      'tox.ini',
      'sconstruct',
      'sconscript',
      'buck',
      'targets',
      'build',
      'workspace',
      'readme',
      'license',
      'notice',
      'changelog',
      'contributing',
      'codeowners',
      'maintainers',
      'authors',
      'copying',
      'security',
      'support',
      'code_of_conduct',
      'rust-toolchain',
      'jenkinsfile',
      'caddyfile',
      'vagrantfile',
      'rakefile',
      'cakefile',
      'guardfile',
      'fastfile',
      'appfile',
      'deliverfile',
      'matchfile',
      'dangerfile',
      'earthfile',
      'tiltfile',
      'snakefile',
    ].includes(lowerName) ||
    lowerName.endsWith('.sql') ||
    lowerName.endsWith('.graphql') ||
    lowerName.endsWith('.gql') ||
    lowerName.endsWith('.proto') ||
    lowerName.endsWith('.tf') ||
    lowerName.endsWith('.tfvars') ||
    lowerName.endsWith('.hcl') ||
    lowerName.endsWith('.nomad') ||
    lowerName.endsWith('.cue') ||
    lowerName.endsWith('.dhall') ||
    lowerName.endsWith('.rego') ||
    lowerName.endsWith('.jsonnet') ||
    lowerName.endsWith('.libsonnet') ||
    lowerName.endsWith('.star') ||
    lowerName.endsWith('.gotmpl') ||
    lowerName.endsWith('.ytt') ||
    lowerName.endsWith('.ipynb') ||
    lowerName.endsWith('.rmd') ||
    lowerName.endsWith('.qmd') ||
    lowerName.endsWith('.jl') ||
    lowerName.endsWith('.m') ||
    lowerName.endsWith('.do') ||
    lowerName.endsWith('.drawio') ||
    lowerName.endsWith('.puml') ||
    lowerName.endsWith('.plantuml') ||
    lowerName.endsWith('.mermaid') ||
    lowerName.endsWith('.mmd') ||
    lowerName.endsWith('.dot') ||
    lowerName.endsWith('.js') ||
    lowerName.endsWith('.jsx') ||
    lowerName.endsWith('.mjs') ||
    lowerName.endsWith('.cjs') ||
    lowerName.endsWith('.ts') ||
    lowerName.endsWith('.tsx') ||
    lowerName.endsWith('.mts') ||
    lowerName.endsWith('.cts') ||
    lowerName.endsWith('.css') ||
    lowerName.endsWith('.scss') ||
    lowerName.endsWith('.less') ||
    lowerName.endsWith('.vue') ||
    lowerName.endsWith('.svelte') ||
    lowerName.endsWith('.astro') ||
    lowerName.endsWith('.py') ||
    lowerName.endsWith('.sh') ||
    lowerName.endsWith('.bash') ||
    lowerName.endsWith('.zsh') ||
    lowerName.endsWith('.go') ||
    lowerName.endsWith('.rs') ||
    lowerName.endsWith('.java') ||
    lowerName.endsWith('.c') ||
    lowerName.endsWith('.h') ||
    lowerName.endsWith('.cpp') ||
    lowerName.endsWith('.cc') ||
    lowerName.endsWith('.cxx') ||
    lowerName.endsWith('.hpp') ||
    lowerName.endsWith('.cs') ||
    lowerName.endsWith('.php') ||
    lowerName.endsWith('.rb') ||
    lowerName.endsWith('.swift') ||
    lowerName.endsWith('.kt') ||
    lowerName.endsWith('.kts') ||
    lowerName.endsWith('.scala') ||
    lowerName.endsWith('.r') ||
    lowerName.endsWith('.lua') ||
    lowerName.endsWith('.dart') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.xml') ||
    lowerName.endsWith('.opml') ||
    lowerName.endsWith('.rss') ||
    lowerName.endsWith('.atom') ||
    lowerName.endsWith('.rdf') ||
    lowerName.endsWith('.ttl') ||
    lowerName.endsWith('.n3') ||
    lowerName.endsWith('.nt') ||
    lowerName.endsWith('.nq') ||
    lowerName.endsWith('.trig') ||
    lowerName.endsWith('.trix') ||
    lowerName.endsWith('.xhtml') ||
    lowerName.endsWith('.xht') ||
    lowerName.endsWith('.url') ||
    lowerName.endsWith('.webloc') ||
    lowerName.endsWith('.inetloc') ||
    lowerName.endsWith('.webmanifest') ||
    lowerName.endsWith('.har') ||
    lowerName.endsWith('.desktop') ||
    lowerName.endsWith('.bib') ||
    lowerName.endsWith('.ris') ||
    lowerName.endsWith('.enw') ||
    lowerName.endsWith('.nbib') ||
    lowerName.endsWith('.csl') ||
    lowerName.endsWith('.cff') ||
    lowerName.endsWith('.gpx') ||
    lowerName.endsWith('.kml') ||
    lowerName.endsWith('.geojson') ||
    lowerName.endsWith('.topojson') ||
    lowerName.endsWith('.osm') ||
    lowerName.endsWith('.tcx') ||
    lowerName.endsWith('.sarif') ||
    lowerName.endsWith('.spdx') ||
    lowerName.endsWith('.cdx') ||
    lowerName.endsWith('.scancode') ||
    lowerName.endsWith('.vex') ||
    lowerName.endsWith('.csaf') ||
    lowerName.endsWith('.rtf') ||
    lowerName.endsWith('.rst') ||
    lowerName.endsWith('.adoc') ||
    lowerName.endsWith('.asciidoc') ||
    lowerName.endsWith('.tex') ||
    lowerName.endsWith('.latex') ||
    lowerName.endsWith('.org') ||
    lowerName.endsWith('.textile') ||
    lowerName.endsWith('.creole') ||
    lowerName.endsWith('.mediawiki') ||
    lowerName.endsWith('.texi') ||
    lowerName.endsWith('.texinfo') ||
    lowerName.endsWith('.pod') ||
    lowerName.endsWith('.rdoc') ||
    lowerName.endsWith('.wiki') ||
    lowerName.endsWith('.dokuwiki') ||
    lowerName.endsWith('.srt') ||
    lowerName.endsWith('.vtt') ||
    lowerName.endsWith('.ass') ||
    lowerName.endsWith('.ssa') ||
    lowerName.endsWith('.ttml') ||
    lowerName.endsWith('.dfxp') ||
    lowerName.endsWith('.sbv') ||
    lowerName.endsWith('.smi') ||
    lowerName.endsWith('.sami') ||
    lowerName.endsWith('.usf') ||
    lowerName.endsWith('.itt') ||
    lowerName.endsWith('.scc') ||
    lowerName.endsWith('.lrc') ||
    lowerName.endsWith('.po') ||
    lowerName.endsWith('.pot') ||
    lowerName.endsWith('.arb') ||
    lowerName.endsWith('.strings') ||
    lowerName.endsWith('.resx') ||
    lowerName.endsWith('.xliff') ||
    lowerName.endsWith('.xlf') ||
    lowerName.endsWith('.ics') ||
    lowerName.endsWith('.ical') ||
    lowerName.endsWith('.vcf') ||
    lowerName.endsWith('.vcard') ||
    lowerName.endsWith('.eml') ||
    lowerName.endsWith('.mbox') ||
    lowerType === 'text/plain' ||
    lowerType === 'text/csv' ||
    lowerType === 'text/tab-separated-values' ||
    lowerType === 'application/json' ||
    lowerType === 'application/ld+json' ||
    lowerType === 'application/x-ndjson' ||
    lowerType === 'application/yaml' ||
    lowerType === 'application/x-yaml' ||
    lowerType === 'text/yaml' ||
    lowerType === 'application/toml' ||
    lowerType === 'application/x-toml' ||
    lowerType === 'application/graphql' ||
    lowerType === 'application/javascript' ||
    lowerType === 'application/x-javascript' ||
    lowerType === 'application/x-sh' ||
    lowerType === 'application/x-php' ||
    lowerType === 'application/x-ruby' ||
    lowerType === 'application/dart' ||
    lowerType === 'application/xml' ||
    lowerType === 'application/rss+xml' ||
    lowerType === 'application/atom+xml' ||
    lowerType === 'application/xhtml+xml' ||
    lowerType === 'application/rtf' ||
    lowerType === 'text/rtf' ||
    lowerType === 'text/x-rst' ||
    lowerType === 'text/asciidoc' ||
    lowerType === 'text/vtt' ||
    lowerType.startsWith('text/')
  ) {
    return { kind: 'text', format: 'text' };
  }
  if (lowerName.endsWith('.pdf') || lowerType === 'application/pdf') {
    return { kind: 'extractable', format: 'pdf' };
  }
  if (
    lowerName.endsWith('.docx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { kind: 'extractable', format: 'word' };
  }
  if (lowerName.endsWith('.doc') || lowerType === 'application/msword') {
    return { kind: 'legacy-binary-office', format: 'word' };
  }
  if (
    lowerName.endsWith('.xlsx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { kind: 'extractable', format: 'excel' };
  }
  if (lowerName.endsWith('.xls') || lowerType === 'application/vnd.ms-excel') {
    return { kind: 'legacy-binary-office', format: 'excel' };
  }
  if (
    lowerName.endsWith('.pptx') ||
    lowerType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return { kind: 'extractable', format: 'powerpoint' };
  }
  if (lowerName.endsWith('.ppt') || lowerType === 'application/vnd.ms-powerpoint') {
    return { kind: 'legacy-binary-office', format: 'powerpoint' };
  }
  if (lowerName.endsWith('.svg') || lowerType === 'image/svg+xml') {
    return { kind: 'extractable', format: 'image' };
  }
  if (
    lowerType.startsWith('image/') ||
    [
      '.png',
      '.jpg',
      '.jpeg',
      '.jpe',
      '.jfif',
      '.bmp',
      '.tif',
      '.tiff',
      '.webp',
      '.avif',
      '.gif',
      '.heic',
      '.heif',
      '.ico',
      '.icns',
      '.psd',
      '.psb',
      '.raw',
      '.cr2',
      '.cr3',
      '.nef',
      '.arw',
      '.dng',
      '.orf',
      '.rw2',
      '.raf',
      '.pef',
      '.srw',
      '.x3f',
      '.erf',
      '.mos',
      '.ai',
      '.eps',
      '.cdr',
      '.sketch',
      '.fig',
      '.xd',
      '.afdesign',
      '.indd',
    ].some((extension) => lowerName.endsWith(extension)) ||
    [
      'application/postscript',
      'application/eps',
      'application/illustrator',
      'application/vnd.sketch',
      'application/x-figma',
      'application/vnd.adobe.xd',
      'application/x-indesign',
    ].includes(lowerType)
  ) {
    return { kind: 'unavailable-extraction', format: 'image', reason: 'image-ocr-unavailable' };
  }
  if (
    lowerType.startsWith('audio/') ||
    [
      '.mp3',
      '.m4a',
      '.wav',
      '.aac',
      '.ogg',
      '.flac',
      '.opus',
      '.aiff',
      '.wma',
      '.amr',
      '.oga',
      '.mid',
      '.midi',
      '.mka',
      '.ra',
      '.ram',
      '.au',
      '.snd',
      '.caf',
    ].some((extension) => lowerName.endsWith(extension))
  ) {
    return { kind: 'unavailable-extraction', format: 'audio', reason: 'audio-transcription-unavailable' };
  }
  if (
    lowerType.startsWith('video/') ||
    [
      '.mp4',
      '.mov',
      '.webm',
      '.mkv',
      '.avi',
      '.m4v',
      '.mpeg',
      '.mpg',
      '.ogv',
      '.3gp',
      '.3g2',
      '.wmv',
      '.flv',
      '.asf',
      '.rm',
      '.rmvb',
      '.vob',
      '.m2ts',
    ].some((extension) => lowerName.endsWith(extension))
  ) {
    return { kind: 'unavailable-extraction', format: 'video', reason: 'video-transcription-unavailable' };
  }

  return { kind: 'unsupported' };
}
