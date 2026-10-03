import sharp from 'sharp';

async function check() {
    const img = sharp('c:/mes_projets/narvosprime-web-prototype/public/textures/personnage/personnage/akarlys_bioscout_sprite_sheet_1767469962520/akarlys_bioscout_sprite_sheet_1767469962520_frame_00.png');
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    // Top left pixel
    console.log(`Top-left pixel: R=${data[0]} G=${data[1]} B=${data[2]} A=${data[3]}`);
}

check();
