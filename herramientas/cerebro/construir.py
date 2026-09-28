#!/usr/bin/env python3
"""
Construye `public/cerebro/aal.bin`: la malla del atlas AAL (116 áreas) que
dibuja el visor 3D del módulo de psicología.

    git clone --depth 1 --filter=blob:none --sparse https://github.com/niivue/niivue /tmp/niivue
    (cd /tmp/niivue && git sparse-checkout set packages/niivue/demos/images)
    python3 herramientas/cerebro/construir.py /tmp/niivue/packages/niivue/demos/images/aal.mz3

Origen: `aal.mz3` de NiiVue (BSD-2-Clause), superficie por región del atlas
AAL (Tzourio-Mazoyer et al., 2002) en espacio MNI. Ver docs/CREDITOS.md.

Formato de salida (little-endian), pensado para leerse sin librerías:
  0   'AAL1'                     4 bytes
  4   n_vertices  uint32
  8   n_caras     uint32
  12  escala      float32         (mm por unidad entera)
  16  posiciones  int16 × 3 × n_vertices    (x, y, z) · escala = mm MNI
  …   región      uint8 × n_vertices        (1–116)
  …   relleno hasta múltiplo de 4
  …   índices     uint32 × 3 × n_caras
"""
import gzip, struct, sys, os
import numpy as np

def leer_mz3(ruta):
    b = open(ruta, 'rb').read()
    if b[:2] == b'\x1f\x8b':
        b = gzip.decompress(b)
    magia, attr, nf, nv, nskip = struct.unpack('<HHIII', b[:16])
    assert magia == 0x5A4D, 'no es MZ3'
    o = 16 + nskip
    caras = np.frombuffer(b, np.int32, nf * 3, o).reshape(-1, 3); o += nf * 12
    verts = np.frombuffer(b, np.float32, nv * 3, o).reshape(-1, 3); o += nv * 12
    if attr & 4:
        o += nv * 4
    etiquetas = np.frombuffer(b, np.float32, nv, o)
    return caras, verts, etiquetas

def main():
    caras, verts, etq = leer_mz3(sys.argv[1])
    escala = 1 / 256  # ±128 mm caben en int16 con resolución de 4 µm
    q = np.round(verts / escala).astype(np.int16)
    reg = etq.astype(np.uint8)
    cab = b'AAL1' + struct.pack('<IIf', len(verts), len(caras), escala)
    cuerpo = q.tobytes() + reg.tobytes()
    cuerpo += b'\0' * ((4 - (len(cab) + len(cuerpo)) % 4) % 4)
    salida = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'cerebro', 'aal.bin')
    with open(salida, 'wb') as f:
        f.write(cab + cuerpo + caras.astype(np.uint32).tobytes())
    print(salida, len(verts), 'vértices', len(caras), 'caras', os.path.getsize(salida), 'bytes')

if __name__ == '__main__':
    main()
