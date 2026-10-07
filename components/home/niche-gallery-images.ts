import type { GalleryNicheIconId } from "./niche-icons";

export type NicheId =
  | "food"
  | "medicine"
  | "property"
  | "retail"
  | "education";

export type NicheCompany = {
  name: string;
  imageSrc?: string;
  logo?: boolean;
  logoLight?: boolean;
  logoScale?: number;
  /** Absolute inset + transform scale (Titul and similar tall logos). */
  logoScaleTransform?: boolean;
  /** Allow flex logo box to exceed 100% (clipped by card). */
  logoScaleGrow?: boolean;
  /** Brightness multiplier on the logo itself — panel stays as is. */
  logoBright?: number;
  gallery: string[];
};

const GALLERY_COUNT = 8;

function stills(
  folder: "restaurants" | "clinics" | "fitness" | "ecommerce" | "beauty",
  offset = 0,
): string[] {
  return Array.from({ length: GALLERY_COUNT }, (_, i) => {
    const n = ((i + offset) % GALLERY_COUNT) + 1;
    return `/niches/${folder}/${n}.webp`;
  });
}

export type NicheTab = {
  id: NicheId;
  label: string;
  icon: GalleryNicheIconId;
  companies: NicheCompany[];
  /** Multiplies each company logoScale in this tab. */
  logoScaleMultiplier?: number;
};

export const NICHES: NicheTab[] = [
  {
    id: "food",
    label: "Еда",
    icon: "restaurants",
    companies: [
      {
        name: "Double Coffee",
        imageSrc: "/niches/logos/double-coffee.webp",
        logo: true,
        gallery: stills("restaurants"),
      },
      {
        name: "Balqaimaq",
        imageSrc: "/niches/logos/balqaimaq.webp",
        logo: true,
        logoScale: 1.08,
        gallery: stills("restaurants", 2),
      },
      {
        name: "ZP Food",
        imageSrc: "/niches/logos/zp-food.webp",
        logo: true,
        logoScale: 1.48,
        logoScaleGrow: true,
        gallery: stills("restaurants", 4),
      },
      {
        name: "Vkusnoff",
        imageSrc: "/niches/logos/vkusnoff.webp",
        logo: true,
        logoScale: 1.17,
        gallery: stills("restaurants", 6),
      },
    ],
  },
  {
    id: "medicine",
    label: "Медицина",
    icon: "clinics",
    companies: [
      {
        name: "Сад долголетия",
        imageSrc: "/niches/logos/sad-dolgoletiya.webp",
        logo: true,
        logoScale: 0.88,
        gallery: stills("clinics"),
      },
      {
        name: "Elit Stom",
        imageSrc: "/niches/logos/elit-stom.webp",
        logo: true,
        gallery: stills("clinics", 4),
      },
      {
        name: "Nydo",
        imageSrc: "/niches/logos/nydo.webp",
        logo: true,
        gallery: stills("clinics", 0),
      },
    ],
  },
  {
    id: "property",
    label: "Недвижимость и стройка",
    icon: "home",
    logoScaleMultiplier: 0.88,
    companies: [
      {
        name: "BC Bereke",
        imageSrc: "/niches/logos/bc-bereke.webp",
        logo: true,
        logoScale: 1.28,
        logoScaleGrow: true,
        gallery: stills("ecommerce"),
      },
      {
        name: "Titul Town",
        imageSrc: "/niches/logos/titul-town.webp",
        logo: true,
        logoScale: 0.96,
        logoScaleTransform: true,
        gallery: stills("ecommerce", 1),
      },
      {
        name: "TD Zangar",
        imageSrc: "/niches/logos/td-zangar.webp",
        logo: true,
        logoScale: 1.35,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 2),
      },
      {
        name: "Askar Group",
        imageSrc: "/niches/logos/askar-group.webp",
        logo: true,
        logoScale: 1.24,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 3),
      },
      {
        name: "Art Office Group",
        imageSrc: "/niches/logos/art-office-group.webp",
        logo: true,
        logoScale: 0.9,
        gallery: stills("ecommerce", 4),
      },
      {
        name: "Печной проект",
        imageSrc: "/niches/logos/pechnoy-proekt.webp",
        logo: true,
        logoScale: 1.18,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 5),
      },
    ],
  },
  {
    id: "retail",
    label: "Retail и товары",
    icon: "ecommerce",
    companies: [
      // Порядок = измеренный брендовый след в вебе (см. ниже в комментариях ниши):
      // свой сайт/домен, офлайн-точки по городам, СМИ, маркетплейсы.
      {
        // gac.com.kz — официальный дистрибьютор; дилеры Алматы/Астана/Павлодар.
        name: "GAC",
        imageSrc: "/niches/logos/gac.webp",
        logo: true,
        logoScale: 1.65,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 3),
      },
      {
        name: "RAV",
        imageSrc: "/niches/logos/rav.webp",
        logo: true,
        gallery: stills("ecommerce", 0),
      },
      {
        // liderpremium.com, «20 лет», международные выставки (FIW).
        name: "Lider Premium",
        imageSrc: "/niches/logos/lider-premium.webp",
        logo: true,
        gallery: stills("ecommerce", 4),
      },
      {
        // wyp.kz + офлайн-салон в Алматы + сюжеты в СМИ.
        name: "WYP",
        imageSrc: "/niches/logos/wyp.webp",
        logo: true,
        logoScale: 1.12,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 3),
      },
      {
        // Сеть магазинов нац. одежды: Астана, Алматы, Уральск.
        name: "Alkum",
        imageSrc: "/niches/logos/alkum.webp",
        logo: true,
        logoScale: 0.95,
        gallery: stills("ecommerce", 2),
      },
      {
        // витрины на Ozon/Ozon.by/kaspi, своего сайта нет.
        name: "DOMORA",
        imageSrc: "/niches/logos/domora.webp",
        logo: true,
        logoScale: 1.12,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 5),
      },
      {
        name: "City Legend",
        imageSrc: "/niches/logos/city-legend.webp",
        logo: true,
        gallery: stills("ecommerce", 1),
      },
      {
        // под этим именем в KZ индексируются авто-аккумуляторы АКОМ Reactor.
        name: "Reactor",
        imageSrc: "/niches/logos/reactor.webp",
        logo: true,
        logoScale: 1.4,
        logoScaleGrow: true,
        gallery: stills("ecommerce", 1),
      },
      {
        // Artisoft.kz — Шымкент, IT/автоматизация, локальный след.
        name: "Artisoft",
        imageSrc: "/niches/logos/artisoft.webp",
        logo: true,
        logoScale: 0.88,
        gallery: stills("ecommerce", 6),
      },
      {
        name: "LeSparkle Diamonds",
        imageSrc: "/niches/logos/lesparkle.webp",
        logo: true,
        logoScale: 1.1,
        gallery: stills("beauty", 1),
      },
      {
        // Под именем Hwang в KZ-вебе бренд не индексируется.
        name: "Hwang",
        imageSrc: "/niches/logos/hwang.webp",
        logo: true,
        logoScale: 1.45,
        logoScaleGrow: true,
        logoBright: 1.6,
        gallery: stills("ecommerce", 7),
      },
      {
        name: "Brunella",
        imageSrc: "/niches/logos/brunella.webp",
        logo: true,
        logoScale: 1.05,
        gallery: stills("beauty", 0),
      },
    ],
  },
  {
    id: "education",
    label: "Образование и досуг",
    icon: "education",
    companies: [
      {
        name: "FinKeyAI",
        imageSrc: "/niches/logos/finkeyai.webp",
        logo: true,
        logoScale: 1.2,
        logoScaleGrow: true,
        gallery: stills("ecommerce"),
      },
      {
        name: "Qoldau Study",
        imageSrc: "/niches/logos/qoldau.webp",
        logo: true,
        gallery: stills("fitness"),
      },
      {
        name: "Meta",
        imageSrc: "/niches/logos/meta.webp",
        logo: true,
        logoScale: 1.18,
        logoScaleGrow: true,
        gallery: stills("fitness", 3),
      },
      {
        name: "ШоуСочи",
        imageSrc: "/niches/logos/show-sochi.webp",
        logo: true,
        gallery: stills("beauty", 2),
      },
    ],
  },
];
