/**
 * Internationalization (i18n) module
 * Supports: English, Chinese, French, German, Japanese
 */

const I18N = (() => {
    const translations = {
        en: {
            // Header
            'app.title': 'SQLite B-Tree Visualization',
            'app.subtitle': 'Interactive WebAssembly-powered database internals explorer',

            // SQL Editor
            'editor.title': 'SQL Editor',
            'editor.placeholder': 'Enter SQL commands here...\nExample:\nCREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);\nINSERT INTO users VALUES (1, \'Alice\', 30);\nINSERT INTO users VALUES (2, \'Bob\', 25);\nSELECT * FROM users;',
            'btn.execute': 'Execute SQL',
            'btn.step': 'Step Through',
            'btn.clear': 'Clear',

            // Output
            'output.title': 'Query Results',
            'output.placeholder': 'Results will appear here...',
            'output.success': 'SQL executed successfully',
            'output.errorPrefix': 'SQL Error',

            // Events
            'events.title': 'Event Log',
            'events.autoScroll': 'Auto-scroll',
            'events.clearLog': 'Clear Log',

            // Visualization
            'viz.title': 'B-Tree Visualization',
            'viz.view': 'View:',
            'viz.btree': 'B-Tree Structure',
            'viz.parse': 'SQL Parse Tree',
            'viz.vdbe': 'VDBE Execution',
            'viz.transitions': 'Show Transitions',
            'viz.speed': 'Speed:',

            // VDBE Controls
            'vdbe.reset': 'Reset',
            'vdbe.prev': 'Prev',
            'vdbe.next': 'Next Opcode',

            // Node Info
            'nodeInfo.title': 'Node Information',
            'nodeInfo.page': 'Page Number:',
            'nodeInfo.type': 'Type:',
            'nodeInfo.cells': 'Cells:',
            'nodeInfo.children': 'Children:',
            'nodeInfo.cellsTitle': 'Cells:',
            'nodeInfo.leaf': 'Leaf',
            'nodeInfo.interior': 'Interior',
            'nodeInfo.noCells': 'No cells',
            'nodeInfo.viewData': 'View Row Data',
            'nodeInfo.loading': 'Loading...',
            'nodeInfo.noRows': 'No rows found',

            // B-Tree labels (canvas)
            'btree.empty': 'empty',
            'btree.afterSplit': 'after split',
            'btree.leaf': 'LEAF',
            'btree.int': 'INT',

            // Parse view (canvas)
            'parse.title': 'SQL Abstract Syntax Tree',
            'parse.titleWaiting': 'SQL Parse Tree',
            'parse.waiting': 'Execute a SQL query to see its AST',
            'parse.example': 'Example: SELECT id, name FROM users WHERE age > 18;',
            'parse.stats': '{0} tokens parsed | {1} statement(s)',

            // VDBE view (canvas)
            'vdbe.title': 'VDBE Program Execution',
            'vdbe.waiting': 'Execute SQL to see VDBE execution trace',
            'vdbe.idle': 'Execute SQL to see VDBE execution',
            'vdbe.programHeader': 'Program                Opcodes  Result',
            'vdbe.program': 'Program #{0}',
            'vdbe.totalPrograms': 'Total: {0} programs executed',
            'vdbe.morePrograms': '... and {0} more programs',
            'vdbe.totalOpcodes': 'Total opcodes: {0}',
            'vdbe.showing': ' (showing {0}-{1})',
            'vdbe.state.idle': 'Idle',
            'vdbe.state.starting': 'Program starting',
            'vdbe.state.executing': 'Executing',
            'vdbe.state.complete': 'Complete',
            'vdbe.state.stepping': 'Stepping',
            'vdbe.expected': 'Expected {0} opcodes',
            'vdbe.resultCode': 'Result code: {0}',
            'vdbe.opcodeOf': 'Opcode {0} of {1}',
            'vdbe.stepInfo': 'Step {0}/{1}: [{2}] {3}',
            'vdbe.ready': 'Ready',

            // Status bar
            'status.initializing': 'Initializing SQLite WebAssembly...',
            'status.ready': 'Ready',
            'status.executing': 'Executing SQL...',
            'status.error': 'Error',
            'status.events': 'Events:',
            'status.pages': 'Pages:',
            'status.status': 'Status:',

            // Loading
            'loading.message': 'Loading SQLite WebAssembly module...',
            'loading.wasmError': 'WASM not available — run: make build-wasm',

            // Query errors
            'error.noDb': 'Database not initialized',
            'error.noSql': 'Please enter SQL to execute',
            'error.noSqlStep': 'Please enter SQL to step through',
            'error.noStatements': 'No SQL statements found',
            'error.noRowids': 'No rowids',
            'error.noTable': 'Cannot determine table for page {0}',
            'error.unknownTable': 'Unknown table for root page {0}',
            'error.dbOpen': 'Failed to open database: {0}',
            'error.wasmNotFound': 'SQLite WASM module not found. Please build the project using "make build-wasm"',

            // Cell display
            'cell.display': 'Cell {0}: {1} ({2} bytes)',
            'cell.more': '... and {0} more',

            // Step through
            'step.allDone': 'All statements executed. Starting from beginning.',
            'step.progress': 'Step {0}/{1}: {2}',

            // Keywords for AST colors (keep as-is, these are SQL keywords)
            // Format strings
        },

        zh: {
            'app.title': 'SQLite B-Tree 可视化',
            'app.subtitle': '基于 WebAssembly 的交互式数据库内部原理探索工具',

            'editor.title': 'SQL 编辑器',
            'editor.placeholder': '在此输入 SQL 命令...\n示例:\nCREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);\nINSERT INTO users VALUES (1, \'Alice\', 30);\nINSERT INTO users VALUES (2, \'Bob\', 25);\nSELECT * FROM users;',
            'btn.execute': '执行 SQL',
            'btn.step': '逐步执行',
            'btn.clear': '清空',

            'output.title': '查询结果',
            'output.placeholder': '结果将在此显示...',
            'output.success': 'SQL 执行成功',
            'output.errorPrefix': 'SQL 错误',

            'events.title': '事件日志',
            'events.autoScroll': '自动滚动',
            'events.clearLog': '清空日志',

            'viz.title': 'B-Tree 可视化',
            'viz.view': '视图:',
            'viz.btree': 'B-Tree 结构',
            'viz.parse': 'SQL 解析树',
            'viz.vdbe': 'VDBE 执行',
            'viz.transitions': '显示过渡',
            'viz.speed': '速度:',

            'vdbe.reset': '重置',
            'vdbe.prev': '上一步',
            'vdbe.next': '下一步 Opcode',

            'nodeInfo.title': '节点信息',
            'nodeInfo.page': '页码:',
            'nodeInfo.type': '类型:',
            'nodeInfo.cells': '单元数:',
            'nodeInfo.children': '子节点:',
            'nodeInfo.cellsTitle': '单元:',
            'nodeInfo.leaf': '叶子',
            'nodeInfo.interior': '内部',
            'nodeInfo.noCells': '无单元',
            'nodeInfo.viewData': '查看行数据',
            'nodeInfo.loading': '加载中...',
            'nodeInfo.noRows': '未找到数据',

            'btree.empty': '空',
            'btree.afterSplit': '分裂后',
            'btree.leaf': '叶',
            'btree.int': '内',

            'parse.title': 'SQL 语法树',
            'parse.titleWaiting': 'SQL 解析树',
            'parse.waiting': '执行 SQL 查询以查看语法树',
            'parse.example': '示例: SELECT id, name FROM users WHERE age > 18;',
            'parse.stats': '{0} 个 token 已解析 | {1} 条语句',

            'vdbe.title': 'VDBE 程序执行',
            'vdbe.waiting': '执行 SQL 以查看 VDBE 执行轨迹',
            'vdbe.idle': '执行 SQL 以查看 VDBE 执行',
            'vdbe.programHeader': '程序               操作数  结果',
            'vdbe.program': '程序 #{0}',
            'vdbe.totalPrograms': '总计: {0} 个程序已执行',
            'vdbe.morePrograms': '... 还有 {0} 个程序',
            'vdbe.totalOpcodes': '总操作数: {0}',
            'vdbe.showing': ' (显示 {0}-{1})',
            'vdbe.state.idle': '空闲',
            'vdbe.state.starting': '程序启动',
            'vdbe.state.executing': '执行中',
            'vdbe.state.complete': '完成',
            'vdbe.state.stepping': '步进',
            'vdbe.expected': '预计 {0} 个操作',
            'vdbe.resultCode': '结果码: {0}',
            'vdbe.opcodeOf': '操作 {0} / {1}',
            'vdbe.stepInfo': '步骤 {0}/{1}: [{2}] {3}',
            'vdbe.ready': '就绪',

            'status.initializing': '正在初始化 SQLite WebAssembly...',
            'status.ready': '就绪',
            'status.executing': '正在执行 SQL...',
            'status.error': '错误',
            'status.events': '事件:',
            'status.pages': '页数:',
            'status.status': '状态:',

            'loading.message': '正在加载 SQLite WebAssembly 模块...',
            'loading.wasmError': 'WASM 不可用 — 请运行: make build-wasm',

            'error.noDb': '数据库未初始化',
            'error.noSql': '请输入 SQL 语句',
            'error.noSqlStep': '请输入要逐步执行的 SQL',
            'error.noStatements': '未找到 SQL 语句',
            'error.noRowids': '无行 ID',
            'error.noTable': '无法确定页 {0} 对应的表',
            'error.unknownTable': '未知根页 {0} 对应的表',
            'error.dbOpen': '打开数据库失败: {0}',
            'error.wasmNotFound': '未找到 SQLite WASM 模块，请运行 "make build-wasm"',

            'cell.display': '单元 {0}: {1} ({2} 字节)',
            'cell.more': '... 还有 {0} 个',

            'step.allDone': '所有语句已执行完毕，从头开始。',
            'step.progress': '步骤 {0}/{1}: {2}',
        },

        fr: {
            'app.title': 'Visualisation SQLite B-Tree',
            'app.subtitle': 'Explorateur interactif des internals de base de donnees via WebAssembly',

            'editor.title': 'Editeur SQL',
            'editor.placeholder': 'Entrez des commandes SQL ici...\nExemple:\nCREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);\nINSERT INTO users VALUES (1, \'Alice\', 30);\nINSERT INTO users VALUES (2, \'Bob\', 25);\nSELECT * FROM users;',
            'btn.execute': 'Executer SQL',
            'btn.step': 'Pas a pas',
            'btn.clear': 'Effacer',

            'output.title': 'Resultats de la requete',
            'output.placeholder': 'Les resultats apparaitront ici...',
            'output.success': 'SQL execute avec succes',
            'output.errorPrefix': 'Erreur SQL',

            'events.title': 'Journal des evenements',
            'events.autoScroll': 'Defilement auto',
            'events.clearLog': 'Effacer le journal',

            'viz.title': 'Visualisation B-Tree',
            'viz.view': 'Vue:',
            'viz.btree': 'Structure B-Tree',
            'viz.parse': 'Arbre syntaxique SQL',
            'viz.vdbe': 'Execution VDBE',
            'viz.transitions': 'Afficher transitions',
            'viz.speed': 'Vitesse:',

            'vdbe.reset': 'Reinitialiser',
            'vdbe.prev': 'Precedent',
            'vdbe.next': 'Opcode suivant',

            'nodeInfo.title': 'Information du noeud',
            'nodeInfo.page': 'Numero de page:',
            'nodeInfo.type': 'Type:',
            'nodeInfo.cells': 'Cellules:',
            'nodeInfo.children': 'Enfants:',
            'nodeInfo.cellsTitle': 'Cellules:',
            'nodeInfo.leaf': 'Feuille',
            'nodeInfo.interior': 'Interieur',
            'nodeInfo.noCells': 'Aucune cellule',
            'nodeInfo.viewData': 'Voir les donnees',
            'nodeInfo.loading': 'Chargement...',
            'nodeInfo.noRows': 'Aucune ligne trouvee',

            'btree.empty': 'vide',
            'btree.afterSplit': 'apres division',
            'btree.leaf': 'FEUILLE',
            'btree.int': 'INT',

            'parse.title': 'Arbre syntaxique abstrait SQL',
            'parse.titleWaiting': 'Arbre syntaxique SQL',
            'parse.waiting': 'Executez une requete SQL pour voir l\'AST',
            'parse.example': 'Exemple: SELECT id, name FROM users WHERE age > 18;',
            'parse.stats': '{0} jetons analyses | {1} instruction(s)',

            'vdbe.title': 'Execution du programme VDBE',
            'vdbe.waiting': 'Executez SQL pour voir la trace VDBE',
            'vdbe.idle': 'Executez SQL pour voir l\'execution VDBE',
            'vdbe.programHeader': 'Programme           OpCodes  Resultat',
            'vdbe.program': 'Programme #{0}',
            'vdbe.totalPrograms': 'Total: {0} programmes executes',
            'vdbe.morePrograms': '... et {0} autres programmes',
            'vdbe.totalOpcodes': 'Total opcodes: {0}',
            'vdbe.showing': ' (affichage {0}-{1})',
            'vdbe.state.idle': 'Inactif',
            'vdbe.state.starting': 'Demarrage',
            'vdbe.state.executing': 'Execution',
            'vdbe.state.complete': 'Termine',
            'vdbe.state.stepping': 'Pas a pas',
            'vdbe.expected': '{0} opcodes attendus',
            'vdbe.resultCode': 'Code resultat: {0}',
            'vdbe.opcodeOf': 'Opcode {0} sur {1}',
            'vdbe.stepInfo': 'Etape {0}/{1}: [{2}] {3}',
            'vdbe.ready': 'Pret',

            'status.initializing': 'Initialisation de SQLite WebAssembly...',
            'status.ready': 'Pret',
            'status.executing': 'Execution SQL...',
            'status.error': 'Erreur',
            'status.events': 'Evenements:',
            'status.pages': 'Pages:',
            'status.status': 'Statut:',

            'loading.message': 'Chargement du module SQLite WebAssembly...',
            'loading.wasmError': 'WASM non disponible — executez: make build-wasm',

            'error.noDb': 'Base de donnees non initialisee',
            'error.noSql': 'Veuillez entrer du SQL a executer',
            'error.noSqlStep': 'Veuillez entrer du SQL a executer pas a pas',
            'error.noStatements': 'Aucune instruction SQL trouvee',
            'error.noRowids': 'Aucun rowid',
            'error.noTable': 'Impossible de determiner la table pour la page {0}',
            'error.unknownTable': 'Table inconnue pour la page racine {0}',
            'error.dbOpen': 'Echec de l\'ouverture de la base de donnees: {0}',
            'error.wasmNotFound': 'Module SQLite WASM introuvable. Veuillez executer "make build-wasm"',

            'cell.display': 'Cellule {0}: {1} ({2} octets)',
            'cell.more': '... et {0} autres',

            'step.allDone': 'Toutes les instructions ont ete executees. Reprise au debut.',
            'step.progress': 'Etape {0}/{1}: {2}',
        },

        de: {
            'app.title': 'SQLite B-Tree Visualisierung',
            'app.subtitle': 'Interaktiver WebAssembly-basierter Datenbank-Intern-Explorer',

            'editor.title': 'SQL-Editor',
            'editor.placeholder': 'SQL-Befehle hier eingeben...\nBeispiel:\nCREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);\nINSERT INTO users VALUES (1, \'Alice\', 30);\nINSERT INTO users VALUES (2, \'Bob\', 25);\nSELECT * FROM users;',
            'btn.execute': 'SQL ausfuhren',
            'btn.step': 'Schrittweise',
            'btn.clear': 'Loschen',

            'output.title': 'Abfrageergebnisse',
            'output.placeholder': 'Ergebnisse werden hier angezeigt...',
            'output.success': 'SQL erfolgreich ausgefuhrt',
            'output.errorPrefix': 'SQL-Fehler',

            'events.title': 'Ereignisprotokoll',
            'events.autoScroll': 'Auto-Scroll',
            'events.clearLog': 'Protokoll loschen',

            'viz.title': 'B-Tree Visualisierung',
            'viz.view': 'Ansicht:',
            'viz.btree': 'B-Tree Struktur',
            'viz.parse': 'SQL Parse-Baum',
            'viz.vdbe': 'VDBE Ausfuhrung',
            'viz.transitions': 'Ubergange anzeigen',
            'viz.speed': 'Geschwindigkeit:',

            'vdbe.reset': 'Zurucksetzen',
            'vdbe.prev': 'Zuruck',
            'vdbe.next': 'Nachster Opcode',

            'nodeInfo.title': 'Knoteninformation',
            'nodeInfo.page': 'Seitennummer:',
            'nodeInfo.type': 'Typ:',
            'nodeInfo.cells': 'Zellen:',
            'nodeInfo.children': 'Kinder:',
            'nodeInfo.cellsTitle': 'Zellen:',
            'nodeInfo.leaf': 'Blatt',
            'nodeInfo.interior': 'Intern',
            'nodeInfo.noCells': 'Keine Zellen',
            'nodeInfo.viewData': 'Daten anzeigen',
            'nodeInfo.loading': 'Laden...',
            'nodeInfo.noRows': 'Keine Zeilen gefunden',

            'btree.empty': 'leer',
            'btree.afterSplit': 'nach Aufspaltung',
            'btree.leaf': 'BLATT',
            'btree.int': 'INT',

            'parse.title': 'SQL Abstrakter Syntaxbaum',
            'parse.titleWaiting': 'SQL Parse-Baum',
            'parse.waiting': 'Fuhren Sie eine SQL-Abfrage aus, um den AST zu sehen',
            'parse.example': 'Beispiel: SELECT id, name FROM users WHERE age > 18;',
            'parse.stats': '{0} Token analysiert | {1} Anweisung(en)',

            'vdbe.title': 'VDBE Programmausfuhrung',
            'vdbe.waiting': 'SQL ausfuhren, um VDBE-Ausfuhrungstrace zu sehen',
            'vdbe.idle': 'SQL ausfuhren, um VDBE-Ausfuhrung zu sehen',
            'vdbe.programHeader': 'Programm              Opcodes  Ergebnis',
            'vdbe.program': 'Programm #{0}',
            'vdbe.totalPrograms': 'Gesamt: {0} Programme ausgefuhrt',
            'vdbe.morePrograms': '... und {0} weitere Programme',
            'vdbe.totalOpcodes': 'Gesamte Opcodes: {0}',
            'vdbe.showing': ' (Anzeige {0}-{1})',
            'vdbe.state.idle': 'Leerlauf',
            'vdbe.state.starting': 'Programmstart',
            'vdbe.state.executing': 'Ausfuhrung',
            'vdbe.state.complete': 'Fertig',
            'vdbe.state.stepping': 'Schrittweise',
            'vdbe.expected': '{0} Opcodes erwartet',
            'vdbe.resultCode': 'Ergebniscode: {0}',
            'vdbe.opcodeOf': 'Opcode {0} von {1}',
            'vdbe.stepInfo': 'Schritt {0}/{1}: [{2}] {3}',
            'vdbe.ready': 'Bereit',

            'status.initializing': 'SQLite WebAssembly wird initialisiert...',
            'status.ready': 'Bereit',
            'status.executing': 'SQL wird ausgefuhrt...',
            'status.error': 'Fehler',
            'status.events': 'Ereignisse:',
            'status.pages': 'Seiten:',
            'status.status': 'Status:',

            'loading.message': 'SQLite WebAssembly-Modul wird geladen...',
            'loading.wasmError': 'WASM nicht verfugbar — ausfuhren: make build-wasm',

            'error.noDb': 'Datenbank nicht initialisiert',
            'error.noSql': 'Bitte geben Sie SQL zum Ausfuhren ein',
            'error.noSqlStep': 'Bitte geben Sie SQL zum schrittweisen Ausfuhren ein',
            'error.noStatements': 'Keine SQL-Anweisungen gefunden',
            'error.noRowids': 'Keine Rowids',
            'error.noTable': 'Tabelle fur Seite {0} kann nicht bestimmt werden',
            'error.unknownTable': 'Unbekannte Tabelle fur Wurzelseite {0}',
            'error.dbOpen': 'Datenbank konnte nicht geoffnet werden: {0}',
            'error.wasmNotFound': 'SQLite WASM-Modul nicht gefunden. Bitte "make build-wasm" ausfuhren',

            'cell.display': 'Zelle {0}: {1} ({2} Bytes)',
            'cell.more': '... und {0} weitere',

            'step.allDone': 'Alle Anweisungen ausgefuhrt. Neubeginn.',
            'step.progress': 'Schritt {0}/{1}: {2}',
        },

        ja: {
            'app.title': 'SQLite B-Tree \u53ef\u8996\u5316',
            'app.subtitle': 'WebAssembly\u30d9\u30fc\u30b9\u306e\u30a4\u30f3\u30bf\u30e9\u30af\u30c6\u30a3\u30d6\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u5185\u90e8\u63a2\u7d22\u30c4\u30fc\u30eb',

            'editor.title': 'SQL\u30a8\u30c7\u30a3\u30bf',
            'editor.placeholder': '\u3053\u3053\u306bSQL\u30b3\u30de\u30f3\u30c9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044...\n\u4f8b:\nCREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);\nINSERT INTO users VALUES (1, \'Alice\', 30);\nINSERT INTO users VALUES (2, \'Bob\', 25);\nSELECT * FROM users;',
            'btn.execute': 'SQL\u3092\u5b9f\u884c',
            'btn.step': '\u30b9\u30c6\u30c3\u30d7\u5b9f\u884c',
            'btn.clear': '\u30af\u30ea\u30a2',

            'output.title': '\u30af\u30a8\u30ea\u7d50\u679c',
            'output.placeholder': '\u7d50\u679c\u306f\u3053\u3053\u306b\u8868\u793a\u3055\u308c\u307e\u3059...',
            'output.success': 'SQL\u304c\u6b63\u5e38\u306b\u5b9f\u884c\u3055\u308c\u307e\u3057\u305f',
            'output.errorPrefix': 'SQL\u30a8\u30e9\u30fc',

            'events.title': '\u30a4\u30d9\u30f3\u30c8\u30ed\u30b0',
            'events.autoScroll': '\u81ea\u52d5\u30b9\u30af\u30ed\u30fc\u30eb',
            'events.clearLog': '\u30ed\u30b0\u3092\u30af\u30ea\u30a2',

            'viz.title': 'B-Tree \u53ef\u8996\u5316',
            'viz.view': '\u8868\u793a:',
            'viz.btree': 'B-Tree \u69cb\u9020',
            'viz.parse': 'SQL \u69cb\u6587\u30c4\u30ea\u30fc',
            'viz.vdbe': 'VDBE \u5b9f\u884c',
            'viz.transitions': '\u30c8\u30e9\u30f3\u30b8\u30b7\u30e7\u30f3\u8868\u793a',
            'viz.speed': '\u901f\u5ea6:',

            'vdbe.reset': '\u30ea\u30bb\u30c3\u30c8',
            'vdbe.prev': '\u524d\u3078',
            'vdbe.next': '\u6b21\u306e\u30aa\u30da\u30b3\u30fc\u30c9',

            'nodeInfo.title': '\u30ce\u30fc\u30c9\u60c5\u5831',
            'nodeInfo.page': '\u30da\u30fc\u30b8\u756a\u53f7:',
            'nodeInfo.type': '\u30bf\u30a4\u30d7:',
            'nodeInfo.cells': '\u30bb\u30eb\u6570:',
            'nodeInfo.children': '\u5b50\u30ce\u30fc\u30c9:',
            'nodeInfo.cellsTitle': '\u30bb\u30eb:',
            'nodeInfo.leaf': '\u30ea\u30fc\u30d5',
            'nodeInfo.interior': '\u5185\u90e8',
            'nodeInfo.noCells': '\u30bb\u30eb\u306a\u3057',
            'nodeInfo.viewData': '\u884c\u30c7\u30fc\u30bf\u3092\u898b\u308b',
            'nodeInfo.loading': '\u8aad\u307f\u8fbc\u307f\u4e2d...',
            'nodeInfo.noRows': '\u884c\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093',

            'btree.empty': '\u7a7a',
            'btree.afterSplit': '\u5206\u5272\u5f8c',
            'btree.leaf': '\u30ea\u30fc\u30d5',
            'btree.int': 'INT',

            'parse.title': 'SQL \u62bd\u8c61\u69cb\u6587\u30c4\u30ea\u30fc',
            'parse.titleWaiting': 'SQL \u69cb\u6587\u30c4\u30ea\u30fc',
            'parse.waiting': 'SQL\u30af\u30a8\u30ea\u3092\u5b9f\u884c\u3057\u3066AST\u3092\u8868\u793a',
            'parse.example': '\u4f8b: SELECT id, name FROM users WHERE age > 18;',
            'parse.stats': '{0}\u500b\u306e\u30c8\u30fc\u30af\u30f3\u3092\u89e3\u6790 | {1}\u500b\u306e\u30b9\u30c6\u30fc\u30c8\u30e1\u30f3\u30c8',

            'vdbe.title': 'VDBE\u30d7\u30ed\u30b0\u30e9\u30e0\u5b9f\u884c',
            'vdbe.waiting': 'SQL\u3092\u5b9f\u884c\u3057\u3066VDBE\u5b9f\u884c\u30c8\u30ec\u30fc\u30b9\u3092\u8868\u793a',
            'vdbe.idle': 'SQL\u3092\u5b9f\u884c\u3057\u3066VDBE\u5b9f\u884c\u3092\u8868\u793a',
            'vdbe.programHeader': '\u30d7\u30ed\u30b0\u30e9\u30e0          \u30aa\u30da\u30b3\u30fc\u30c9  \u7d50\u679c',
            'vdbe.program': '\u30d7\u30ed\u30b0\u30e9\u30e0 #{0}',
            'vdbe.totalPrograms': '\u5408\u8a08: {0}\u500b\u306e\u30d7\u30ed\u30b0\u30e9\u30e0\u304c\u5b9f\u884c\u6e08\u307f',
            'vdbe.morePrograms': '... \u4ed6\u306b{0}\u500b\u306e\u30d7\u30ed\u30b0\u30e9\u30e0',
            'vdbe.totalOpcodes': '\u5408\u8a08\u30aa\u30da\u30b3\u30fc\u30c9: {0}',
            'vdbe.showing': ' ({0}-{1}\u3092\u8868\u793a)',
            'vdbe.state.idle': '\u5f85\u6a5f',
            'vdbe.state.starting': '\u30d7\u30ed\u30b0\u30e9\u30e0\u958b\u59cb',
            'vdbe.state.executing': '\u5b9f\u884c\u4e2d',
            'vdbe.state.complete': '\u5b8c\u4e86',
            'vdbe.state.stepping': '\u30b9\u30c6\u30c3\u30d7\u5b9f\u884c',
            'vdbe.expected': '{0}\u500b\u306e\u30aa\u30da\u30b3\u30fc\u30c9\u3092\u4e88\u671f',
            'vdbe.resultCode': '\u7d50\u679c\u30b3\u30fc\u30c9: {0}',
            'vdbe.opcodeOf': '\u30aa\u30da\u30b3\u30fc\u30c9 {0}/{1}',
            'vdbe.stepInfo': '\u30b9\u30c6\u30c3\u30d7 {0}/{1}: [{2}] {3}',
            'vdbe.ready': '\u6e96\u5099\u5b8c\u4e86',

            'status.initializing': 'SQLite WebAssembly\u3092\u521d\u671f\u5316\u4e2d...',
            'status.ready': '\u6e96\u5099\u5b8c\u4e86',
            'status.executing': 'SQL\u5b9f\u884c\u4e2d...',
            'status.error': '\u30a8\u30e9\u30fc',
            'status.events': '\u30a4\u30d9\u30f3\u30c8:',
            'status.pages': '\u30da\u30fc\u30b8:',
            'status.status': '\u30b9\u30c6\u30fc\u30bf\u30b9:',

            'loading.message': 'SQLite WebAssembly\u30e2\u30b8\u30e5\u30fc\u30eb\u3092\u30ed\u30fc\u30c9\u4e2d...',
            'loading.wasmError': 'WASM\u304c\u5229\u7528\u3067\u304d\u307e\u305b\u3093 \u2014 \u5b9f\u884c: make build-wasm',

            'error.noDb': '\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u304c\u521d\u671f\u5316\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
            'error.noSql': 'SQL\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044',
            'error.noSqlStep': '\u30b9\u30c6\u30c3\u30d7\u5b9f\u884c\u3059\u308bSQL\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044',
            'error.noStatements': 'SQL\u30b9\u30c6\u30fc\u30c8\u30e1\u30f3\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093',
            'error.noRowids': 'rowid\u304c\u3042\u308a\u307e\u305b\u3093',
            'error.noTable': '\u30da\u30fc\u30b8{0}\u306e\u30c6\u30fc\u30d6\u30eb\u3092\u7279\u5b9a\u3067\u304d\u307e\u305b\u3093',
            'error.unknownTable': '\u30eb\u30fc\u30c8\u30da\u30fc\u30b8{0}\u306e\u30c6\u30fc\u30d6\u30eb\u304c\u4e0d\u660e\u3067\u3059',
            'error.dbOpen': '\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u306e\u30aa\u30fc\u30d7\u30f3\u306b\u5931\u6557: {0}',
            'error.wasmNotFound': 'SQLite WASM\u30e2\u30b8\u30e5\u30fc\u30eb\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002"make build-wasm"\u3092\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044',

            'cell.display': '\u30bb\u30eb {0}: {1} ({2}\u30d0\u30a4\u30c8)',
            'cell.more': '... \u4ed6\u306b{0}\u500b',

            'step.allDone': '\u3059\u3079\u3066\u306e\u30b9\u30c6\u30fc\u30c8\u30e1\u30f3\u30c8\u304c\u5b9f\u884c\u6e08\u307f\u3002\u6700\u521d\u304b\u3089\u518d\u958b\u3002',
            'step.progress': '\u30b9\u30c6\u30c3\u30d7 {0}/{1}: {2}',
        }
    };

    let currentLang = 'en';

    return {
        /** Get supported languages */
        getLanguages() {
            return [
                { code: 'en', name: 'English' },
                { code: 'zh', name: '\u4e2d\u6587' },
                { code: 'fr', name: 'Fran\u00e7ais' },
                { code: 'de', name: 'Deutsch' },
                { code: 'ja', name: '\u65e5\u672c\u8a9e' }
            ];
        },

        /** Get current language code */
        getLang() { return currentLang; },

        /** Set current language */
        setLang(lang) {
            if (translations[lang]) {
                currentLang = lang;
                localStorage.setItem('sqlitevis-lang', lang);
            }
        },

        /** Initialize language from localStorage or browser */
        initLang() {
            const saved = localStorage.getItem('sqlitevis-lang');
            if (saved && translations[saved]) {
                currentLang = saved;
                return;
            }
            // Try browser language
            const browserLang = (navigator.language || 'en').substring(0, 2).toLowerCase();
            if (translations[browserLang]) {
                currentLang = browserLang;
            }
        },

        /**
         * Get translated string
         * @param {string} key - translation key
         * @param {...string} args - format arguments ({0}, {1}, etc.)
         * @returns {string}
         */
        t(key, ...args) {
            let text = translations[currentLang]?.[key] || translations.en[key] || key;
            if (args.length > 0) {
                for (let i = 0; i < args.length; i++) {
                    text = text.replace(`{${i}}`, args[i]);
                }
            }
            return text;
        },

        /**
         * Update all data-i18n elements in the DOM
         */
        updateDOM() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                el.textContent = this.t(key);
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                el.placeholder = this.t(key);
            });
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                el.title = this.t(key);
            });
        }
    };
})();

// Make globally available
window.I18N = I18N;
