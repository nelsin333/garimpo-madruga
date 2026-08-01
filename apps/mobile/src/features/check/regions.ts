import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Ícone por região do checklist (fallback: câmera). */
const REGION_ICONS: Partial<Record<string, IoniconName>> = {
  front: 'image-outline',
  back: 'sync-outline',
  neck_tag: 'pricetag-outline',
  wash_tag: 'water-outline',
  logo: 'ribbon-outline',
  embroidery: 'color-wand-outline',
  print: 'brush-outline',
  stitching: 'git-commit-outline',
  collar_stitch: 'git-commit-outline',
  hem_stitch: 'git-commit-outline',
  pocket_stitch: 'git-commit-outline',
  cuffs: 'watch-outline',
  buttons: 'ellipse-outline',
  zipper: 'remove-outline',
  hardware: 'construct-outline',
  lining: 'layers-outline',
  interior_label: 'bookmark-outline',
  serial: 'barcode-outline',
  size_tag: 'resize-outline',
  hang_tag: 'pricetags-outline',
  qr_code: 'qr-code-outline',
  insole: 'footsteps-outline',
  outsole: 'footsteps-outline',
  heel_tab: 'footsteps-outline',
  box_label: 'cube-outline',
  packaging: 'cube-outline',
  receipt: 'receipt-outline',
  defects: 'alert-circle-outline',
};

export function regionIcon(region: string): IoniconName {
  return REGION_ICONS[region] ?? 'camera-outline';
}

/** Ícone por categoria do wizard. */
const CATEGORY_ICONS: Record<string, IoniconName> = {
  camiseta: 'shirt-outline',
  hoodie: 'shirt-outline',
  crewneck: 'shirt-outline',
  jaqueta: 'shirt-outline',
  calca: 'man-outline',
  shorts: 'man-outline',
  tenis: 'footsteps-outline',
  bone: 'school-outline',
  bolsa: 'bag-handle-outline',
  outro: 'shapes-outline',
};

export function categoryIcon(slug: string): IoniconName {
  return CATEGORY_ICONS[slug] ?? 'shapes-outline';
}
