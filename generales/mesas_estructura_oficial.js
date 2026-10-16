/* Estructura oficial de mesas (fuente: MESAS NOV 2027.xlsx)
   SECC, MESA, LI, LF, ELECTOR, NLOCAL → seccion, mesa, li, lf, censo, colegio */
const MESAS_ESTRUCTURA_OFICIAL = [
  {
    "seccion": "001",
    "mesa": "A",
    "li": "A",
    "lf": "C",
    "censo": 730,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "001",
    "mesa": "B",
    "li": "D",
    "lf": "G",
    "censo": 616,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "001",
    "mesa": "C",
    "li": "H",
    "lf": "O",
    "censo": 664,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "001",
    "mesa": "D",
    "li": "P",
    "lf": "Z",
    "censo": 672,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "002",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 455,
    "colegio": "C.E.I.P. LA ESCUELA"
  },
  {
    "seccion": "002",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 526,
    "colegio": "C.E.I.P. LA ESCUELA"
  },
  {
    "seccion": "003",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 880,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "004",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 694,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "004",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 772,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "005",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 622,
    "colegio": "C.E.I.P. VICTORIA KENT"
  },
  {
    "seccion": "005",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 582,
    "colegio": "C.E.I.P. VICTORIA KENT"
  },
  {
    "seccion": "006",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 773,
    "colegio": "C.E.I.P. JARAMA"
  },
  {
    "seccion": "006",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 707,
    "colegio": "C.E.I.P. JARAMA"
  },
  {
    "seccion": "007",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 584,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "007",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 576,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "008",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 892,
    "colegio": "C.E.I.P. LOS ALMENDROS"
  },
  {
    "seccion": "009",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 646,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "009",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 653,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "010",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 511,
    "colegio": "C.E.I.P. LA ESCUELA"
  },
  {
    "seccion": "010",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 472,
    "colegio": "C.E.I.P. LA ESCUELA"
  },
  {
    "seccion": "011",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 771,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "012",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 559,
    "colegio": "C.E.I.P. VICTORIA KENT"
  },
  {
    "seccion": "012",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 570,
    "colegio": "C.E.I.P. VICTORIA KENT"
  },
  {
    "seccion": "013",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 681,
    "colegio": "C.E.I.P. RAFAEL ALBERTI"
  },
  {
    "seccion": "013",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 744,
    "colegio": "C.E.I.P. RAFAEL ALBERTI"
  },
  {
    "seccion": "014",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 710,
    "colegio": "C.E.I.P. LOS ALMENDROS"
  },
  {
    "seccion": "014",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 638,
    "colegio": "C.E.I.P. LOS ALMENDROS"
  },
  {
    "seccion": "015",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 678,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "015",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 621,
    "colegio": "I.E.S. LAS LAGUNAS"
  },
  {
    "seccion": "016",
    "mesa": "A",
    "li": "A",
    "lf": "F",
    "censo": 553,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "016",
    "mesa": "B",
    "li": "G",
    "lf": "M",
    "censo": 629,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "016",
    "mesa": "C",
    "li": "N",
    "lf": "Z",
    "censo": 654,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "017",
    "mesa": "A",
    "li": "A",
    "lf": "F",
    "censo": 552,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "017",
    "mesa": "B",
    "li": "G",
    "lf": "M",
    "censo": 784,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "017",
    "mesa": "C",
    "li": "N",
    "lf": "Z",
    "censo": 610,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "018",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 740,
    "colegio": "C.E.I.P. JARAMA"
  },
  {
    "seccion": "019",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 535,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "019",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 573,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "020",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 630,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "020",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 599,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "021",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 880,
    "colegio": "C.E.I.P. RAFAEL ALBERTI"
  },
  {
    "seccion": "022",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 599,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "022",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 539,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "023",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 765,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "023",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 806,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "024",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 666,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "024",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 571,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "025",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 751,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "025",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 727,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "026",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 561,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "026",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 560,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "027",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 710,
    "colegio": "C.E.I.P. EL OLIVAR"
  },
  {
    "seccion": "028",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 694,
    "colegio": "C.E.I.P. VICTORIA KENT"
  },
  {
    "seccion": "029",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 695,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "029",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 760,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "030",
    "mesa": "A",
    "li": "A",
    "lf": "F",
    "censo": 572,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "030",
    "mesa": "B",
    "li": "G",
    "lf": "M",
    "censo": 709,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "030",
    "mesa": "C",
    "li": "N",
    "lf": "Z",
    "censo": 635,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "031",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 582,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "031",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 537,
    "colegio": "C.E.I.P. LAS CIGUEÑAS"
  },
  {
    "seccion": "032",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 894,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "032",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 864,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "033",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 819,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "033",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 892,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "034",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 722,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "034",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 758,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "035",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 751,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "035",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 742,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "036",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 703,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "036",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 650,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "037",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 663,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "037",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 665,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "038",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 649,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "038",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 600,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "039",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 629,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "039",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 723,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "040",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 922,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "041",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 813,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "041",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 850,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "042",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 486,
    "colegio": "C.E.I.P. LOS ALMENDROS"
  },
  {
    "seccion": "042",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 496,
    "colegio": "C.E.I.P. LOS ALMENDROS"
  },
  {
    "seccion": "043",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 570,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "043",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 538,
    "colegio": "C.E.I.P. JOSE SARAMAGO"
  },
  {
    "seccion": "044",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 600,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "044",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 579,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "045",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 594,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "045",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 534,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "046",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 820,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "046",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 872,
    "colegio": "C.E.I.P. JOSE HIERRO"
  },
  {
    "seccion": "047",
    "mesa": "A",
    "li": "A",
    "lf": "F",
    "censo": 558,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "047",
    "mesa": "B",
    "li": "G",
    "lf": "M",
    "censo": 693,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "047",
    "mesa": "C",
    "li": "N",
    "lf": "Z",
    "censo": 604,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "048",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 716,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "048",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 664,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "049",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 597,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "049",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 619,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "050",
    "mesa": "U",
    "li": "A",
    "lf": "Z",
    "censo": 746,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "051",
    "mesa": "A",
    "li": "A",
    "lf": "F",
    "censo": 526,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "051",
    "mesa": "B",
    "li": "G",
    "lf": "M",
    "censo": 694,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "051",
    "mesa": "C",
    "li": "N",
    "lf": "Z",
    "censo": 648,
    "colegio": "CIUDAD EDUCATIVA MUNICIPAL HIPATIA"
  },
  {
    "seccion": "052",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 643,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "052",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 712,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "053",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 485,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "053",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 522,
    "colegio": "C.E.I.P.S.O LA LUNA"
  },
  {
    "seccion": "054",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 613,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "054",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 568,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "055",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 811,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "055",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 863,
    "colegio": "C.E.I.P. HANS CHRISTIAN ANDERSEN"
  },
  {
    "seccion": "056",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 629,
    "colegio": "C.E.I.P. RAFAEL ALBERTI"
  },
  {
    "seccion": "056",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 567,
    "colegio": "C.E.I.P. RAFAEL ALBERTI"
  },
  {
    "seccion": "057",
    "mesa": "A",
    "li": "A",
    "lf": "L",
    "censo": 590,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "057",
    "mesa": "B",
    "li": "M",
    "lf": "Z",
    "censo": 532,
    "colegio": "C.E.I.P. JOSE ITURZAETA"
  },
  {
    "seccion": "058",
    "mesa": "A",
    "li": "A",
    "lf": "K",
    "censo": 477,
    "colegio": "C.E.I.P. DULCE CHACON"
  },
  {
    "seccion": "058",
    "mesa": "B",
    "li": "L",
    "lf": "Z",
    "censo": 466,
    "colegio": "C.E.I.P. DULCE CHACON"
  }
];
