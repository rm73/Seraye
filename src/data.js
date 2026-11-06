export const PHOTO_ADDON = 10000;
export const STANDARD_DP = 100000;
export const MUA_DP = 200000;
export const MUA_ADDON_PRICE = 260000;

export const packages = [
  {
    id: "sempurna",
    code: "SMPR",
    name: "Sempurna",
    group: "photography",
    groupLabel: "Katalog Semarak",
    price: 589000,
    compareAt: 629000,
    highlight: true,
    specialOffer: true,
    includesMua: true,
    image: "/assets/opt/cards/SempurnaCard.webp",
    cardPoints: [
      "Base Paket Sekejap",
      "Reguler Makeup by Anadevi (75 Menit)",
      "Free Transport MUA (Bandung Kota)",
    ],
    points: [
      "1 Graduate",
      "60 Minutes",
      "25 Edited Photo",
      "Reguler Makeup by Anadevi (75 Menit)",
      "Free Transport MUA (Bandung Kota)",
      "Unlimited People (Friends & Family)",
      "Unlimited Spot & Shoot",
      "Personalized Moodboard & Styling",
    ],
  },
  {
    id: "sekejap",
    code: "SKJP",
    name: "Sekejap",
    group: "photography",
    groupLabel: "Katalog Semarak",
    price: 329000,
    compareAt: 350000,
    bestSeller: true,
    highlight: true,
    muaAddon: true,
    image: "/assets/opt/cards/sekejapcard.webp",
    points: [
      "1 Graduate",
      "60 Minutes",
      "25 Edited Photo",
      "Unlimited People (Friends & Family)",
      "Unlimited Spot & Shoot",
      "Personalized Moodboard & Styling",
    ],
  },
  {
    id: "sekilas",
    code: "SKLS",
    name: "Sekilas",
    group: "photography",
    groupLabel: "Katalog Semarak",
    price: 275000,
    compareAt: 299000,
    image: "/assets/opt/cards/SekilasCard.webp",
    points: [
      "1 Graduate",
      "45 Minutes",
      "15 Edited Photo",
      "Up to 2 Friends/Family (Add-on +50K)",
      "Unlimited Spot & Shoot",
      "Recommendation Styling",
    ],
  },
  {
    id: "sejenak",
    code: "SJNK",
    name: "Sejenak",
    group: "photography",
    groupLabel: "Katalog Semarak",
    price: 429000,
    compareAt: 450000,
    image: "/assets/opt/cards/Sejenakcard.webp",
    points: [
      "1 Graduate",
      "90 Minutes",
      "30 Edited Photo",
      "Unlimited People (Friends & Family)",
      "Unlimited Spot & Shoot",
      "Personalized Moodboard & Styling",
    ],
  },
  {
    id: "sekisah",
    code: "SKSH",
    name: "Sekisah",
    group: "videography",
    groupLabel: "Katalog Selangkah",
    price: 249000,
    compareAt: 299000,
    image: "/assets/opt/cards/SekisahCard.webp",
    points: [
      "1 Graduate",
      "30 Minutes",
      "All raw Photo",
      "1 video portrait/landscape edited (30 detik)",
      "Unlimited People (Friends & Family)",
      "Unlimited Spot & Shoot",
      "Personalized Moodboard & Styling",
    ],
  },
  {
    id: "sekawan",
    code: "SKWN",
    name: "Sekawan",
    group: "videography",
    groupLabel: "Katalog Selangkah",
    price: 349000,
    compareAt: 399000,
    image: "/assets/opt/cards/SekawanCard.webp",
    points: [
      "2-3 Graduate",
      "60 Minutes",
      "All raw photo",
      "1 video portrait/landscape edited (60s)",
      "Unlimited People (Friends & Family)",
      "Unlimited Spot & Shoot",
      "Personalized Moodboard & Styling",
    ],
  },
];

export const faqGroups = [
  {
    title: "Pertanyaan Seputar Booking & Konsep",
    items: [
      {
        question: "Apakah saya bisa menentukan konsep fotonya?",
        answer:
          "Tentu! Setelah kamu melakukan pembayaran DP, tim Seraye akan berdiskusi dan membuatkan personalized moodboard khusus untukmu. Referensi gaya, vibe, dan tone warna ini akan menjadi panduan agar hasil foto nanti benar-benar terkonsep dan sesuai dengan keinginanmu.",
      },
      {
        question: "Bagaimana sistem pembayaran dan pembatalannya?",
        answer:
          "Untuk mengunci jadwal (fix booking), dikenakan DP sebesar Rp100.000. Untuk Paket Sempurna, DP minimum Rp200.000 karena jadwal fotografer dan MUA dikunci bersamaan. DP bersifat non-refundable (hangus jika klien membatalkan sepihak). Sisa pelunasan wajib dibayarkan maksimal H-1 sebelum sesi foto. Apabila pembatalan dilakukan setelah pelunasan atau pada Hari H, seluruh dana tidak dapat dikembalikan.",
      },
      {
        question: "Apakah jadwal foto bisa diubah (reschedule)?",
        answer:
          "Bisa! Reschedule diperbolehkan maksimal 1x dengan pengajuan paling lambat H-3 sebelum sesi, dan persetujuannya bergantung pada ketersediaan jadwal fotografer kami.",
      },
    ],
  },
  {
    title: "Pertanyaan Seputar Pelaksanaan Sesi",
    items: [
      {
        question: "Bisa request lokasi dimana saja?",
        answer:
          "Area Kota Bandung dan sekitarnya tentunya bisa dijangkau oleh rekan Seraye, silahkan diskusikan untuk titik temu dengan admin kami untuk tindak lanjut booking.",
      },
      {
        question: "Bagaimana jika saya datang terlambat di Hari H?",
        answer:
          "Kami sangat menyarankan kamu untuk bersiap 15 - 30 menit sebelum sesi dan sudah berada di meeting point. Keterlambatan lebih dari 15 menit dari jadwal akan otomatis mengurangi total durasi sesi fotomu.",
      },
      {
        question: "Bolehkah mengajak keluarga besar dan bestie?",
        answer:
          "Sangat diperbolehkan sesuai dengan jumlah keterangan katalog untuk keluarga maupun sahabat. Foto formasi keluarga, teman satu geng, hingga foto solo sudah tercakup dalam durasi sesi.",
      },
      {
        question: "Apakah ada arahan gaya/pose (directing) saat sesi pemotretan?",
        answer:
          "Pasti ada. Tim Seraye Moments memandu secara inisiatif dan kolaboratif dengan client. Tidak ada pose kaku, kami mengutamakan nuansa hangat, natural, dan gestur spontan.",
      },
      {
        question: "Apakah saya bisa menambah waktu foto (extend) di lokasi?",
        answer:
          "Bisa banget! Jika kamu merasa butuh waktu lebih saat di lokasi, penambahan waktu (extend) akan dikenakan biaya Rp50.000 per 30 menit.",
      },
    ],
  },
  {
    title: "Pertanyaan Seputar Hasil Foto",
    items: [
      {
        question: "Berapa lama hasil foto akan dikirim?",
        answer:
          "Pengiriman hasil dilakukan bertahap. Pada H+3 kamu akan menerima 5 Foto Highlight + Raw File. Kemudian pada H+7, kami akan mengirimkan Sisa Editan beserta Bonusnya.",
      },
      {
        question: "Apakah bisa menambah jumlah foto yang diedit?",
        answer:
          "Tentu, kamu bisa melakukan Add-On Edit Foto di paket mana pun dengan biaya Rp10.000 per foto tambahan. Jumlahnya bisa ditambah atau dikurangi, dan tidak wajib.",
      },
      {
        question: "Apakah foto saya akan diposting di media sosial Seraye Moments?",
        answer:
          "Kami percaya setiap momen patut dirayakan. Seraye Moments akan turut membagikan keindahan momenmu (hasil foto/video) sebagai bagian dari portofolio dan apresiasi karya di media sosial kami.",
      },
    ],
  },
];

export const terms = [
  "Apabila terjadi pembatalan (cancel) reservasi dari pihak klien, maka uang deposit/DP hangus (tidak dapat di-refund).",
  "Batas maksimal untuk pengajuan reschedule (ubah jadwal) adalah H-3 sebelum sesi foto, dan sangat bergantung pada ketersediaan fotografer kami.",
  "Pelunasan pembayaran wajib dilakukan maksimal H-1 sebelum sesi foto.",
  "Apabila pembatalan dilakukan setelah pelunasan atau pada Hari H, maka seluruh dana yang telah dibayarkan tidak dapat dikembalikan.",
  "Jika ada penambahan waktu (extend) pada saat Hari H, maka akan dikenakan biaya tambahan sebesar Rp50.000 / 30 menit.",
  "Mohon mempersiapkan diri sekitar 15 - 30 menit sebelum sesi foto dan sudah berada di meeting point yang ditentukan agar waktu foto lebih maksimal.",
];
