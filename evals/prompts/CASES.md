# Prompt eval: cases

Синтетические входы, по 6 на рецепт. Каждый файл в `cases/`: свойства (что ожидаем), ниже текст, который пользователь вставил бы после промпта.

| id | рецепт | язык карточек | трудность | ожидаем |
| --- | --- | --- | --- | --- |
| c1-printing-en | chapter | en | обычная глава | есть: movable type, cost of books, spread of ideas |
| c2-tides-ru | chapter | ru | русский научно-популярный текст | есть: притяжение Луны, два прилива, сизигийный прилив |
| c3-aqueducts-en-long | chapter | en | длинная глава, много фактов | есть: gravity, gradient, siphon, arches, settling tanks, lead pipes |
| c4-coffee-en-asides | chapter | en | отступления автора и сноски, ловушка на мелочи | есть: Ethiopia or Yemen origin, coffeehouses, roasting; нет: page numbers, the author's cousin |
| c5-autumn-ru | chapter | ru | причинно-следственные цепочки | есть: хлорофилл, каротиноиды, антоцианы, отделительный слой |
| c6-lighthouses-en-quotes | chapter | en | в тексте цитата с > и готовые вопросы | есть: Fresnel lens, light characteristic, keeper |
| g1-rocks-ru | glossary | ru | чистый конспект | есть: магматические, осадочные, метаморфические, выветривание, кристаллизация |
| g2-economics-en-messy | glossary | en | сокращения, стрелки, опечатки | есть: demand, supply, equilibrium, elasticity, substitute; нет: complements, quiz |
| g3-reform-ru-filler | glossary | ru | мусор и термин без определения | есть: крепостное право, выкупные платежи, временнообязанные, земство; нет: домашнее задание, Валуев, Мировые посредники |
| g4-intervals-en-headings | glossary | en | в конспекте уже есть заголовки и таблица | есть: interval, octave, perfect fifth, major third, semitone |
| g5-anatomy-ru-latin | glossary | ru | русский конспект с латинскими терминами | есть: femur, humerus, scapula, patella, sternum |
| g6-chemistry-en-short | glossary | en | очень короткий конспект | есть: atom, molecule, ion |
| n1-bridges-en | notes | en | часть имён хорошие, часть слабые | вопрос для: Notes on arches 2.md; без вопроса: Golden Gate Bridge.md, Suspension bridge.md |
| n2-plants-ru | notes | ru | русские заметки, имена вида «Заметка 12» | вопрос для: Заметка 12.md; без вопроса: Фотосинтез.md, Устьица.md |
| n3-empty-note-en | notes | en | пустая заметка и заметка без ответа | без вопроса: Volcano.md, Magma.md; пропустить: Ideas.md, Untitled.md |
| n4-existing-props-en | notes | en | у заметок уже есть свойства | вопрос для: Planet notes Tuesday.md; без вопроса: Mercury.md |
| n5-question-names-ru | notes | ru | имена уже вопросы или фразы | вопрос для: Конспект 3 физика.md; без вопроса: Почему небо голубое.md, Радуга.md |
| n6-similar-en | notes | en | две заметки о похожем, вопросы не должны совпасть | вопрос для: Lecture 4 part 1.md, Lecture 4 part 2.md; без вопроса: Ocean currents.md |
| v1-spanish-en | vocabulary | en | просто список, язык пользователя английский | есть: perro, gato, caballo, vaca, oveja, cerdo, gallina, pato; flashy-lang: es |
| v2-italian-ru | vocabulary | ru | русский пользователь, единственная подсказка о языке: строка по-русски | есть: binario, biglietto, ritardo, coincidenza, partire, stazione, carrozza, scendere; flashy-lang: it |
| v3-german-en-gender | vocabulary | en | существительные без артиклей, умлауты | есть: Brücke, Straße, Mädchen, Löffel, Tür, Schlüssel; flashy-lang: de |
| v4-japanese-ru | vocabulary | ru | другое письмо, русский пользователь | есть: 水, 山, 川, 空, 雨; flashy-lang: ja |
| v5-italian-text-ru | vocabulary | ru | слова надо выбрать из текста | есть: mercato, formaggio, pane, frutta; flashy-lang: it |
| v6-french-en-duplicates | vocabulary | en | повторы и омонимы с разным родом | есть: livre, tour, pomme, maison; flashy-lang: fr |

## c1-printing-en

````text
Around 1440, Johannes Gutenberg in Mainz combined several existing technologies into a working printing press. The key idea was movable type: small metal letters cast in a mould, which could be arranged into a page, inked, printed, and then reused for the next page. Earlier block printing in Europe needed a whole carved wooden block for every page, so a mistake ruined the block and nothing could be reused.

Gutenberg also developed an oil-based ink that stuck to metal, and adapted the screw press that wine makers used to squeeze grapes. Together these let a small workshop print hundreds of identical copies of a page in a day.

The effects came quickly. Books that had taken a scribe months to copy became affordable to merchants and students, and by 1500 presses were working in more than two hundred European towns. Because every copy was identical, scholars in different cities could refer to the same page and line. Ideas also spread faster than authorities could control them: in the 1520s Martin Luther's pamphlets were printed in hundreds of thousands of copies within a few years.
````

## c2-tides-ru

````text
Почему бывают приливы

Луна притягивает к себе всю Землю, но ближнюю к Луне сторону океана сильнее, чем центр планеты, а дальнюю слабее. Из-за этой разницы вода вытягивается в два горба: один обращён к Луне, другой в противоположную сторону. Земля поворачивается под этими горбами, поэтому в большинстве мест бывает два прилива и два отлива в сутки.

Солнце тоже создаёт приливы, но примерно вдвое слабее лунных, потому что оно гораздо дальше. Когда Солнце, Земля и Луна выстраиваются в линию, в новолуние и полнолуние, их действие складывается, и приливы самые высокие. Такие приливы называют сизигийными. Когда Луна и Солнце находятся под прямым углом друг к другу, в первой и последней четверти, приливы самые слабые: это квадратурные приливы.

Высота прилива сильно зависит от формы берега. В открытом океане вода поднимается меньше чем на метр, а в узком заливе Фанди в Канаде разница между приливом и отливом доходит до шестнадцати метров.
````

## c3-aqueducts-en-long

````text
Roman aqueducts: water by gravity

Rome at its height had perhaps a million inhabitants, and by the third century AD eleven aqueducts brought them water from springs and rivers in the hills, some more than ninety kilometres away. None of them used pumps. An aqueduct was a channel that ran slightly downhill all the way from the source to the city, and gravity alone kept the water moving.

The hard part was the gradient. If the channel dropped too steeply, the water ran fast enough to scour the lining and damage the channel; if it dropped too little, the water stagnated and silt built up. Roman engineers usually aimed for a fall of somewhere between fifteen centimetres and three metres per kilometre. Surveyors measured levels with a long wooden table called a chorobates, which had plumb lines and a groove that could be filled with water to check that it was level.

Most of an aqueduct's length was not the famous arched bridge at all. Around eighty percent of the channels ran underground or at ground level, following the contours of the hills. Underground channels were protected from enemies, from evaporation and from animals, and they needed less material. Arches were built only where the channel had to cross a valley while keeping its gentle slope. The Pont du Gard in southern France, about fifty metres tall, carried the channel to Nîmes across the river Gardon.

When a valley was too deep for arches, engineers sometimes built an inverted siphon. Water ran down into sealed pipes, crossed the valley floor and rose up the far side. Because the outlet was lower than the inlet, the pressure of the water itself pushed it up the other slope. Siphons needed strong pipes, usually of lead, and they were expensive, so they were rare.

Before the water reached the city it passed through settling tanks, where sand and mud sank to the bottom. In the city it arrived at a distribution tank called a castellum. From there pipes, often made of lead, carried it to public fountains, baths and, for a fee, private houses. When water ran short, the supply to public fountains was kept first and private houses lost theirs first.

Maintenance never stopped. Limescale built up inside the channels and had to be chipped away; inspection shafts along the underground sections let workers climb down. In the first century AD, the official in charge of Rome's water, Frontinus, wrote a book about the aqueducts in which he complained about illegal pipes that farmers and householders secretly connected to the channels.
````

## c4-coffee-en-asides

````text
Chapter 4. How coffee crossed the world

(I wrote most of this chapter in a café in Lisbon, which my cousin finds very funny. See also p. 112.)

Coffee plants grow wild in the highlands of Ethiopia, but the first clear evidence of people drinking coffee comes from Sufi monasteries in Yemen in the fifteenth century, where it helped monks stay awake through night prayers.[1] From Yemen the drink spread to Mecca, Cairo and Istanbul.

The coffeehouse was the real invention. In Istanbul in the sixteenth century, coffeehouses became places where men met to talk, play games and hear news, and rulers several times tried to close them because they feared political gossip. The same thing happened later in London, where coffeehouses were nicknamed "penny universities": for the price of a cup anyone could listen to merchants, scientists and writers.

Roasting changed the taste completely. Green coffee beans taste grassy; heating them sets off chemical reactions that create hundreds of new aroma compounds and turn the beans brown. Light roasts keep more acidity, dark roasts taste more bitter.

[1] The legend of the goatherd Kaldi, whose goats danced after eating coffee berries, appears only in texts written centuries later.
````

## c5-autumn-ru

````text
Почему осенью желтеют листья

Летом лист зелёный, потому что в нём много хлорофилла. Хлорофилл улавливает свет для фотосинтеза и постоянно разрушается на солнце, поэтому растение всё время производит его заново.

Осенью дни становятся короче и холоднее, и дерево перестаёт производить хлорофилл. Старый хлорофилл распадается, а ценные вещества из него, прежде всего азот, дерево забирает в ствол и корни на зиму. Когда зелёного пигмента становится мало, проявляются жёлтые и оранжевые каротиноиды, которые были в листе всё лето, просто их не было видно.

Красный цвет появляется иначе. Антоцианы в листьях клёна или осины образуются заново именно осенью, из сахаров, которые остаются в листе. Больше всего их бывает при солнечных днях и холодных, но не морозных ночах, поэтому в такую осень листва особенно яркая.

У основания черешка образуется отделительный слой из клеток, которые ослабляют связь листа с веткой. Когда слой готов, лист опадает от ветра или собственного веса, а ранка на ветке уже закрыта защитной тканью.
````

## c6-lighthouses-en-quotes

````text
Lighthouses

What makes one lighthouse different from another at night? Each has its own light characteristic: a pattern of flashes and dark periods, such as one white flash every ten seconds, printed on sea charts so a sailor can tell which light is which.

Early lighthouses burned wood or coal in open fires, and later oil lamps with mirrors behind them. In 1822 Augustin Fresnel designed a lens made of rings of glass prisms. It bent light from a single lamp into a strong horizontal beam, so a light could be seen more than thirty kilometres away while using far less fuel.

A keeper's journal from 1870 describes the work:

> Wound the clockwork at midnight and again at four. Trimmed the wick twice. Fog from three until dawn; sounded the horn every half minute.

Why did keepers wind clockwork? The clockwork turned the lens so the beam swept round and produced the flashes. Today almost all lighthouses are automatic, and the last keepers in many countries left in the 1980s and 1990s.
````

## g1-rocks-ru

````text
Лекция 2. Горные породы

Магматические породы образуются при остывании магмы или лавы. Если магма остывает глубоко под землёй, получаются крупные кристаллы (гранит), если на поверхности, мелкие (базальт).

Осадочные породы образуются из частиц, которые принесли вода и ветер, и из остатков организмов. Слои уплотняются и цементируются. Примеры: песчаник, известняк.

Метаморфические породы получаются из других пород под действием высокой температуры и давления без плавления. Мрамор получается из известняка, гнейс из гранита.

Выветривание: разрушение пород на поверхности под действием воды, льда, перепадов температуры и живых организмов.

Кристаллизация: рост кристаллов минерала при остывании расплава или испарении раствора. Чем медленнее остывание, тем крупнее кристаллы.

Круговорот пород: любая порода со временем может стать породой другого типа.
````

## g2-economics-en-messy

````text
econ 101 - wk3 notes

demand = how much ppl want to buy at each price. price up -> qty demanded down (law of demand)
supply: how much sellers offer at each price, price up -> qty supplied up
equilibrium - where S and D curves cross, no shortage no surplus. mkt "clears"
price elasticity of demand: how strongly qty demanded reacts to a price change. elastic = big reaction (e.g. restaurant meals), inelastic = small (salt, insulin)
substitute goods - can replace each other, tea vs coffee. price of coffee up -> demand for tea up
complements (pls check textbook p.54 for def)
!! quiz on friday, bring calculator
````

## g3-reform-ru-filler

````text
Семинар 5. Отмена крепостного права

Сначала организационное: домашнее задание на следующую неделю, прочитать главу 7. Староста соберёт тетради.

Крепостное право: зависимость крестьян от помещика, крестьянин был прикреплён к земле и обязан работать на помещика или платить оброк. Отменено манифестом 19 февраля 1861 года.

Выкупные платежи: деньги, которые крестьяне выплачивали государству за свои наделы. Государство заранее заплатило помещикам, а крестьяне возвращали эту сумму 49 лет.

Временнообязанные крестьяне: крестьяне, которые после реформы до перехода на выкуп продолжали нести повинности в пользу помещика.

Земство: выборное местное самоуправление в уездах и губерниях, введено в 1864 году. Занималось школами, больницами и дорогами.

Валуев. (преподаватель упомянул, надо посмотреть, кто это)

Мировые посредники: тоже было на слайде, не успел записать.
````

## g4-intervals-en-headings

````text
# Music theory: intervals

## Basics
### Semitone
The smallest step on a piano: from one key to the very next, black or white.

### Interval
The distance between two notes, counted in letter names and in semitones.

## Common intervals

| Interval | Semitones | Sounds like |
| --- | --- | --- |
| Major third | 4 | bright, happy |
| Perfect fifth | 7 | open, stable |
| Octave | 12 | the same note, higher |

The octave: the frequency doubles. Perfect fifth is the base of power chords. A major third on top of a root gives a major chord its bright sound.
````

## g5-anatomy-ru-latin

````text
Анатомия, кости скелета (с латынью к зачёту)

Femur (бедренная кость): самая длинная и прочная кость тела, соединяет тазобедренный и коленный суставы.
Humerus (плечевая кость): длинная кость плеча, от плечевого сустава до локтевого.
Scapula (лопатка): плоская треугольная кость на задней поверхности грудной клетки, к ней крепятся мышцы плеча.
Patella (надколенник): небольшая кость в сухожилии четырёхглавой мышцы, защищает коленный сустав спереди.
Sternum (грудина): плоская кость в центре грудной клетки, к ней крепятся рёбра.
Зачёт по латинским названиям, произношение тоже спрашивают.
````

## g6-chemistry-en-short

````text
Chem intro, lesson 1.
An atom is the smallest unit of an element that keeps its properties.
A molecule is two or more atoms held together by chemical bonds.
An ion is an atom or molecule with an electric charge, because it has lost or gained electrons.
````

## n1-bridges-en

````text
### Golden Gate Bridge.md
A suspension bridge across the strait at the entrance to San Francisco Bay, opened in 1937. Its towers are 227 m tall and its colour is called "International Orange".

### Suspension bridge.md
A bridge whose deck hangs from vertical cables attached to two main cables, which run over towers and are anchored at both ends. It can span longer distances than any other kind of bridge.

### Notes on arches 2.md
An arch carries weight by turning it into compression: each stone pushes on the next one, and the load goes down and outwards into the supports. That is why arches need strong abutments at the sides.

### Why bridges sway.md
Wind and walking people push a bridge in rhythm. If that rhythm matches the bridge's natural frequency, the movement grows: this is resonance. Engineers add dampers to absorb it.
````

## n2-plants-ru

````text
### Фотосинтез.md
Процесс, при котором растение на свету строит сахар из углекислого газа и воды. Побочный продукт: кислород.

### Заметка 12.md
Корни растения всасывают воду в основном через корневые волоски, тонкие выросты клеток кожицы. Волоски сильно увеличивают площадь, через которую идёт всасывание.

### Устьица.md
Маленькие отверстия в кожице листа. Через них лист поглощает углекислый газ и испаряет воду. Каждое устьице окружено двумя замыкающими клетками, которые его открывают и закрывают.
````

## n3-empty-note-en

````text
### Volcano.md
An opening in the Earth's crust through which molten rock, gas and ash escape. Most volcanoes form where tectonic plates meet.

### Magma.md
Molten rock below the surface. Once it reaches the surface it is called lava.

### Untitled.md

### Ideas.md
- maybe something about geysers?
- ask Sam
````

## n4-existing-props-en

````text
### Mercury.md
---
tags: [astronomy, planets]
created: 2026-10-02
---
The smallest planet and the closest to the Sun. A year there lasts 88 Earth days, and it has almost no atmosphere, so nights are extremely cold.

### Planet notes Tuesday.md
---
tags: [astronomy]
---
Venus is hotter than Mercury even though it is farther from the Sun, because its thick carbon dioxide atmosphere traps heat.
````

## n5-question-names-ru

````text
### Почему небо голубое.md
Воздух рассеивает синий свет сильнее, чем красный, потому что у синего короче длина волны. Рассеянный синий свет приходит к нам со всех сторон неба.

### Радуга.md
Дуга из цветов спектра на небе, которая появляется, когда солнечный свет преломляется и отражается в каплях дождя. Солнце при этом за спиной у наблюдателя.

### Конспект 3 физика.md
Звук в воздухе распространяется со скоростью около 340 метров в секунду, а свет почти мгновенно. Поэтому молнию мы видим раньше, чем слышим гром.
````

## n6-similar-en

````text
### Lecture 4 part 1.md
Warm surface water from the tropics flows towards the poles. The Gulf Stream carries warm water from the Gulf of Mexico across the Atlantic, which is why western Europe has milder winters than Canada at the same latitude.

### Lecture 4 part 2.md
Near the poles, sea water gets cold and salty when ice forms, so it becomes dense and sinks. This sinking water flows back towards the equator along the ocean floor and drives the slow global circulation.

### Ocean currents.md
Large, steady movements of sea water, driven by wind, the Earth's rotation and differences in temperature and saltiness.
````

## v1-spanish-en

````text
perro, gato, caballo, vaca, oveja, cerdo, gallina, pato
````

## v2-italian-ru

````text
Вот слова из поездки по Италии, сделай карточки:
il binario, il biglietto, in ritardo, la coincidenza, partire, la stazione, la carrozza, scendere
````

## v3-german-en-gender

````text
German words from my lesson (nouns, I didn't write the articles down): Brücke, Straße, Mädchen, Löffel, Tür, Schlüssel. Also the verbs fahren and laufen.
````

## v4-japanese-ru

````text
Мой родной язык русский. Японские слова из первого урока:
水 (みず), 山 (やま), 川 (かわ), 空 (そら), 雨 (あめ)
````

## v5-italian-text-ru

````text
Выбери из этого текста слова, которые стоит выучить новичку, и сделай карточки (я говорю по-русски):

Ogni sabato vado al mercato con mia nonna. Compriamo il pane fresco, un po' di formaggio e tanta frutta: mele, pere e arance. Il venditore è sempre gentile e ci regala qualche fragola.
````

## v6-french-en-duplicates

````text
French words, some repeat because I copied them from two lists:
le livre, la livre, la tour, le tour, la pomme, la maison, le livre, la pomme
````
