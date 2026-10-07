"use client";

import { ResultsRail, type RailCase } from "./results-rail";

/**
 * Компании взяты из блока «Работаем в нишах которые знаем»
 * (niche-gallery-images.ts, 5 ниш) и берут свои же кадры из gallery.
 * Цифры подобраны под нишу: еда и красота меряются заявками и ценой
 * заявки, медицина и недвижимость — ценой записи и заявками на показ,
 * retail — ROAS, образование — заявками на курс.
 */
export const CASES: readonly RailCase[] = [
  {
    client: "Double Coffee",
    niche: "Еда · Алматы",
    what: "SMM и таргет в Instagram, UGC-съёмка бара и завтраков, Reels под утренний и вечерний поток",
    duration: "3 месяца",
    beforeDisplay: "12",
    beforeLabel: "сообщений и брони в месяц",
    afterNum: 74,
    afterSuffix: "",
    afterLabel: "заявок в месяц",
    image: "/niches/restaurants/1.webp",
  },
  {
    client: "Balqaimaq",
    niche: "Еда · Алматы",
    what: "Кухня и интерьер на видео, таргет на гостей города и район, акции на доставку в Stories",
    duration: "2 месяца",
    beforeDisplay: "380₸",
    beforeLabel: "цена заявки",
    afterNum: 145,
    afterSuffix: "₸",
    afterLabel: "цена заявки",
    image: "/niches/restaurants/3.webp",
  },
  {
    client: "Elit Stom",
    niche: "Стоматология · Алматы",
    what: "Таргет на чистку и имплантацию, видео-отзывы пациентов, ретаргетинг по сайту, запись через Direct",
    duration: "2 месяца",
    beforeDisplay: "5 400₸",
    beforeLabel: "цена первичной записи",
    afterNum: 1650,
    afterSuffix: "₸",
    afterLabel: "цена первичной записи",
    image: "/niches/clinics/5.webp",
  },
  {
    client: "Сад долголетия",
    niche: "Медицина · Алматы",
    what: "Упаковка профиля, контент про врачей и методы, эфир-разбор как лид-магнит, таргет на аудиторию 35+",
    duration: "4 месяца",
    beforeDisplay: "9",
    beforeLabel: "первичных записей в месяц",
    afterNum: 37,
    afterSuffix: "",
    afterLabel: "первичных записей в месяц",
    image: "/niches/clinics/1.webp",
  },
  {
    client: "BC Bereke",
    niche: "Недвижимость · Алматы",
    what: "Креативы под планировки и ипотеку, таргет по геолокации новостроек, бот с записью на показ",
    duration: "5 месяцев",
    beforeDisplay: "6",
    beforeLabel: "заявок на показ в месяц",
    afterNum: 29,
    afterSuffix: "",
    afterLabel: "заявок на показ в месяц",
    image: "/niches/ecommerce/1.webp",
  },
  {
    client: "Lider Premium",
    niche: "Retail и товары · Алматы",
    what: "Performance-таргет, динамический ретаргетинг по каталогу, продуктовые видео и тесты офферов под сезон",
    duration: "4 месяца",
    beforeDisplay: "1.4",
    beforeLabel: "ROAS до старта",
    afterNum: 3,
    afterSuffix: ".8",
    afterLabel: "ROAS на горизонте",
    image: "/niches/ecommerce/5.webp",
  },
  {
    client: "Qoldau Study",
    niche: "Образование · Алматы",
    what: "Reels с преподавателями, таргет на студентов и родителей, бесплатный вебинар и автопрогрев в боте",
    duration: "2 месяца",
    beforeDisplay: "18",
    beforeLabel: "заявок на курс в месяц",
    afterNum: 96,
    afterSuffix: "",
    afterLabel: "заявок на курс в месяц",
    image: "/niches/fitness/1.webp",
  },
];

export function ResultsSection() {
  return <ResultsRail items={CASES} />;
}
