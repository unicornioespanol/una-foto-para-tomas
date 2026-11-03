import {readFile,writeFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('data/audio-manifest.json','utf8'));
const playback=JSON.parse(await readFile('test-results/audio-playback.json','utf8'));
const edits=JSON.parse(await readFile('data/cat-eye-retouch.json','utf8'));
const entries=[...Object.entries(manifest.story).map(([id,file])=>({id,file})),...Object.entries(manifest.short).map(([id,a])=>({id,file:a.file}))];
const fileNames=new Set(entries.map(e=>e.file)),extra=(await readdir('assets/audio')).filter(f=>f.endsWith('.mp3')&&!fileNames.has(f));
const rows=[];for(const e of entries){const info=playback.find(p=>p.id===e.id);const bytes=await readFile('assets/audio/'+e.file);rows.push(`| ${e.id} | assets/audio/${e.file} | Подключён; ${info.duration.toFixed(2)} с; декодирование/начало/конец OK |`);e.sha256=createHash('sha256').update(bytes).digest('hex')}
await writeFile('data/audio-inventory.json',JSON.stringify(entries,null,2)+'\n');
const text=`# Финальная интеграция аудио и интерфейса · 29 октября 2026

Подключены **29 исходных MP3**: 14 сюжетных и 15 коротких. Исходные имена, содержимое файлов и утверждённые story.json/activities.json сохранены. Карта: data/audio-manifest.json; контрольные суммы записей: data/audio-inventory.json. Ничего не генерировалось, TTS в приложении не вызывается.

## ID → реальный MP3 → статус

| Узел / кнопка | Реальный путь | Статус |
| --- | --- | --- |
${rows.join('\n')}

Лишние записи: ${extra.length?extra.join(', '):'нет'}. Неоднозначные соответствия: нет. Отсутствующие обязательные записи из списка 14 + 15: нет. Суффиксы _1/_2 и описательные сюжетные имена сохранены, исходники не переименованы.

Техническая проверка: все 29 MP3 целиком декодированы Web Audio, воспроизведены в HTMLAudioElement в начале и у конца, достигнуто событие ended. Четыре маршрута в интерфейсе выбирают правильные 14 имён; end-story разделён на photo/drawing. Это проверка файлов, маршрутизации и воспроизведения. Дословное речевое содержание человеком/ASR в этой среде не подтверждалось; смысловое соответствие установлено по переданным именам/ID. Таймкодов нет: синхронная подсветка реплик и слов не имитируется. На s03/b06 воспроизводится исключительно готовый файл, дополнительные ветер/напев не накладываются.

## Тексты без отдельных записей

В папке нет аудио для вопроса pre-prediction, общей инструкции matching, feedback, пересказов E1 и динамических фраз E3. Они остаются читаемыми; не показываются неработающие кнопки озвучки и не подставляется системный голос. Слова matching и опорные реплики E2 имеют собственные рабочие кнопки. Для «Кто есть кто» проигрывается только текущая реплика, не три подряд.

## Плеер и интерфейс

- Один AudioController, настоящий pause/resume с текущей позиции, повтор с начала, остановка до навигации и при скрытии вкладки. Поздние события старых объектов и отклонённые play-промисы не меняют новый экран. Без autoplay и без синтеза.
- Карточки семьи выбираются из двух перестановок без совпадений с порядком реплик. familyOrder сохранён в прогрессе и восстанавливается при возврате/перезагрузке. При ошибке порядок не меняется.
- Убраны настройки системного голоса/скорости. «Opciones» содержит только перезапуск и существующий доступ к согласию в research-режиме. Mostrar/Ocultar texto сохранены.
- Исправлены явные строки mobile matching-grid, гибкое сжатие и размеры кнопок: Comprobar не пересекается с карточками, feedback и нижней навигацией в состояниях ошибки/успеха на шести размерах из ТЗ. Переполнение не скрывается.
- Схема сервера/БД не менялась. Клиент передаёт существующие audio_started/paused/stopped/ended/repeated с source=file; pause/resume сохраняет один audio_play_id и не удваивает starts.

## Точечная ретушь кота

Просмотрены контактные листы 36 файлов: сцены с desktop/mobile и общими финалами, используемые референсы, cat-варианты альбома и memory-cat. Исправлены только семь сплошных радужек без тёмного центра; существующие нормальные зрачки, закрытые глаза и взгляд со спины оставлены.

| PNG | Изменённые пиксели | Область |
| --- | --- | --- |
${edits.map(e=>`| ${e.file} | ${e.changedPixels} из ${e.totalPixels} | Только внутри радужек |`).join('\n')}

Все пиксели вне семи проверенных масок сохранены побайтно в декодированном PNG. Размеры и композиция не менялись. У соответствующих WebP обновлены веб-копии. Резервные исходники: backups/before-final-audio/assets/scenes. До/после: test-results/cat-eyes/retouched-*.png. Точные координаты и хеши: data/cat-eye-retouch.json. Исходный book_update не изменён.

## Сборки и запуск

Dev: npm.cmd run dev. Build: npm.cmd run build. В dist/assets/audio лежат отдельные MP3 с исходными именами; в HTML нет data:audio/base64 записей.

Для открытия без сервера использовать **всю папку offline/**: внутри Una foto para Tomas.html и assets/audio/*.mp3. Корневой HTML тоже работает с соседней assets/audio. Передача одного HTML сохраняет чтение и картинки, но не переносит звук. В file:// аналитика выключена.

## Изменённые файлы

data/audio-manifest.json, data/audio-inventory.json, data/cat-eye-retouch.json; src/audio-controller.js, src/audio-map.js, src/family-order.js, src/main.js, src/pre-activities.js, src/activities.js, src/storage.js, src/telemetry.js, src/update.css; vite.config.js; tools/audio-assets.mjs, tools/standalone.mjs, tools/prepare-assets.mjs, tools/file-audio.test.mjs, tools/audio-browser.mjs, tools/final-audio-ui-browser.mjs, tools/browser-check.mjs, tools/research-browser.mjs, tools/telemetry-browser.mjs, tools/inspect-cat-eyes.mjs, tools/retouch-cat-eyes.mjs, tools/write-audio-report.mjs; пять PNG/WebP выше; package.json, README.md, QA_REPORT.md. Backend, PostgreSQL/PGlite, SQL, согласия и admin API не переписывались. Публикации и платных запросов не было.
`;
await writeFile('AUDIO_UI_REPORT.md',text);console.log('Audio mapping, missing/extra inventory and raster retouch report written.');
