import { MUA_DP, STANDARD_DP } from "./data";

export const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1o58voVEHTa2Q2GrKucJgcKCB1QcI2VmT?usp=sharing";

const driveFiles = [
  ["1i8cm5lW7PbkH0Vh9CAU4ef-g5X1NrgKd", "1778773592057.jpg"],
  ["15oE2MUFTUwupiVtEDnYVJPANl137kB_x", "IMG_1436.PNG"],
  ["16M0mT8T7KeZAiUn8VjBaHOzd5i-N3zNG", "IMG_1437.PNG"],
  ["1ZknYbDR-_rCOtVVMIOYSwsTEVTRMQ9Ba", "IMG_1438.PNG"],
  ["1wdEA1sNt583Z4l3KG9uGMarff5368aoF", "IMG_1439.PNG"],
  ["1l2tnDPDxuy-Ddo_fICYjHOs7Wg7utvsZ", "IMG_1440.PNG"],
  ["13IaVH6yRiRsr8UNujwXKruNTupk28nno", "IMG_1441.PNG"],
  ["1PPCuZH5fD3dbwvQd_X7FekwVxMR6a3SO", "IMG_1442.PNG"],
  ["1hJIR6BuOTDgDbevAR-UeL9TIw7sVv2xU", "IMG_1444.PNG"],
  ["18Ns0pY3pZD5BKIBC8m79UR3JqvkdqH6g", "IMG_1445.PNG"],
  ["1Y9nIR34rQ2fQaYyNyHqLO7HSQvis8w0t", "IMG_1447.PNG"],
  ["1olnaQfYFvNu0lqJfDx0v8nzO3iU0MSTG", "IMG_1448.JPG"],
  ["1iS63M-pvLTCRSYh0HPOJQDs1ij8f78OE", "IMG_2341.jpg"],
  ["1a7pzCN23ondMN7HCNJ6uDSLHrlp_FuV5", "IMG_9510.jpg"],
  ["1aIErFElF1IooxKAUOMcm7EdeMDUSY2fM", "IMG_9513.jpg"],
  ["1qJRiST2tcNLzEU-9y5Q2nfJGGmCMtCt4", "IMG_9514.jpg"],
];

export const drivePhotos = driveFiles.map(([id, name]) => ({ id, name }));

export function drivePhotoSrc(id, width = 900) {
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

// Data booking klien masih contoh sampai layanan akun terhubung ke pemesanan.
export const clientBookings = [
  {
    id: "SR-261206-SKJP",
    packageName: "Sekejap",
    catalog: "Katalog Semarak",
    dateLabel: "6 Desember 2026",
    timeLabel: "09.00",
    location: "Kampus ITB Ganesha",
    photographer: "Raka Pratama",
    editedPhotos: 25,
    addons: 0,
    dp: STANDARD_DP,
    phase: "dp",
    photos: [],
  },
  {
    id: "SR-261118-SMPR",
    packageName: "Sempurna",
    catalog: "Katalog Semarak",
    dateLabel: "18 November 2026",
    timeLabel: "13.00",
    location: "Gedung Sate dan sekitarnya",
    photographer: "Alya Putri",
    editedPhotos: 25,
    addons: 3,
    dp: MUA_DP,
    phase: "photos",
    photos: drivePhotos,
    driveUrl: DRIVE_FOLDER_URL,
  },
  {
    id: "SR-261012-SKLS",
    packageName: "Sekilas",
    catalog: "Katalog Semarak",
    dateLabel: "12 Oktober 2026",
    timeLabel: "15.30",
    location: "Koridor perpustakaan kampus",
    photographer: "Dimas Saputra",
    editedPhotos: 15,
    addons: 1,
    dp: STANDARD_DP,
    phase: "done",
    photos: [],
  },
];

export function editLimit(booking) {
  return booking.editedPhotos + booking.addons;
}
