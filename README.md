# Kitobcha

PDF, Word (.docx), rasm va matn fayllarini kitobcha va boshqa usullarda chiqarishga tayyorlaydigan oddiy ilova. Hammasi brauzerda, qurilmangizda bajariladi: fayllar hech qayerga yuborilmaydi va internet shart emas.

## Imkoniyatlari

**Qabul qiladigan fayllar:** PDF, Word (.docx va eski .doc), JPG/PNG/WebP, .txt. Bir nechta faylni birlashtirish mumkin.

**Chiqarish usullari:**
- Kitobcha, oddiy (bir tomonlama) printer uchun: 2 fayl (old va orqa tomon)
- Kitobcha, avtomatik ikki tomonlama printer uchun: 1 fayl
- Oddiy hujjatni qoʻlda ikki tomonlama chiqarish: toq va juft betlar
- Har varaqda 2 yoki 4 bet
- Kartochkalar: varaqda 4 ta (2×2, A6) yoki 8 ta (4×2, A7), qaychi bilan qirqib olish uchun. Hujjatning har 2 beti bitta kartochka (old va orqa), ikki tomonlama chiqarishda orqasi toʻgʻri tushadi, qirqish uchun punktir chiziqlar chiziladi
- Qutiga stiker: rasmni qutining haqiqiy oʻlchamida (mm) chiqarish, varaqqa imkon qadar koʻp joylash, qirqish belgilari, zaxira, kadr muharriri, oʻlchamlarni nom bilan saqlash va “Sinov: faqat kontur”
- Faqat tanlangan betlarni yangi PDF qilib olish

**Interfeys:** varaq qanday chiqishi rasmda koʻrinadi (old va orqa tomonni aylantirib koʻrish mumkin), yorugʻ/qorongʻi rejim, namuna hujjat bilan sinab koʻrish va oddiy tilda yozilgan rasmli **Yoʻriqnoma** (`yoriqnoma.html`). Ilova internet bor paytda oʻzi yangilanadi.

Qoʻshimcha: A4/A3/Letter, qismlarga boʻlish, sinov rejimi (2 varaq), oʻngdan chapga oʻqiladigan hujjatlar, tikish uchun ichki chet, chetlarni kesish, betlarni burish/oʻchirish/tartibini oʻzgartirish, sahifa raqami, rangsiz (kulrang) chiqarish va chiqarishdan oldin ekranda koʻrish.

> Word fayllar brauzerda taxminiy koʻrinishda PDF ga aylantiriladi (shrift, jadval, rasm saqlanadi, murakkab dizayn biroz farq qilishi mumkin). Aniq koʻrinish kerak boʻlsa, Word da “Saqlash → PDF” qilib, PDF ni tashlang. Eski `.doc` (Word 97-2003) dan faqat matn olinadi: jadval koʻrinishi, rasm va shrift saqlanmaydi. Aniq koʻrinish kerak boʻlsa, Word da PDF qilib saqlang. Parol bilan himoyalangan `.doc` oʻqilmaydi.

## GitHub Pages orqali joylash

1. https://github.com da **New repository** bosing, nomi masalan `kitobcha`, **Public**.
2. Repozitoriya sahifasida **uploading an existing file** ni bosib, shu papkadagi **hamma fayllarni** (papkasiz, hammasi bitta qatorda) sudrab tashlang va **Commit changes** bosing.
3. **Settings → Pages** ga kiring. **Source: Deploy from a branch**, **Branch: main**, papka **/ (root)** ni tanlab **Save** bosing.
4. 1-2 daqiqadan keyin ilova `https://FOYDALANUVCHI.github.io/kitobcha/` manzilida ochiladi.

Git bilan:

```bash
git init
git add .
git commit -m "Kitobcha"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI/kitobcha.git
git push -u origin main
```

## Internetsiz ishlatish

- **Variant A (tavsiya):** GitHub Pages manzilini bir marta internet bilan oching. Brauzer hamma narsani saqlab oladi, keyin internetsiz ham ochiladi. Chrome/Edge da manzil satridagi **Oʻrnatish** tugmasi (yoki sahifa pastidagi “Ilova sifatida oʻrnatish”) bilan alohida ilova qilib qoʻyish mumkin. Telefonda: brauzer menyusi → **Bosh ekranga qoʻshish**.
- **Variant B:** loyihani ZIP qilib yuklab oling, ochib, `index.html` ni brauzerda oching. Server ham, internet ham kerak emas.

Kutubxonalar loyiha ichida: pdf-lib 1.17.1 (MIT), mammoth 1.8.0 (BSD-2), html2canvas 1.4.1 (MIT), pdf.js 3.11.174 (Apache-2.0). Internetdan hech narsa yuklanmaydi.

## Yangilash

Fayllarni oʻzgartirgach, `sw.js` ichidagi `CACHE = "kitobcha-v9"` raqamini oshiring (masalan, `kitobcha-v10`). Ilova fayllari "avval tarmoq" usulida olinadi, shuning uchun internet bor paytda yangilanish bitta qayta ochishda tushadi va ekranda "Yangi versiya tayyor!" xabari chiqadi. Eski (v4 va undan oldingi) nusxa oʻrnatilgan qurilmalarda yangi versiyaga oʻtish uchun ilovani ikki marta qayta ochish kerak.

Yoʻriqnomadagi skrinshotlarni yangilash: `NODE_PATH=$(npm root -g) node tools/shots.js && python3 tools/to_webp.py`.

Eski nusxa keshdan chiqmasa: brauzerda **Ctrl + Shift + R**.
