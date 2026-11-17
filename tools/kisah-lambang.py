import json,re,collections
D='/home/claude/evobible/kisah/'
S=json.load(open(D+'santo.json')); P=json.load(open(D+'perumpamaan.json')); T=json.load(open(D+'tokoh.json'))
def first(txt,rules):
    for pat,v in rules:
        if re.search(pat,txt,re.I): return v
# --- orang kudus: (pola pada nama, simbol, warna) ---
SN=[(r'Santo Yosef','lili','putih'),(r'Yoakim','tunas','putih'),(r'Marselinus','palma','merah'),(r'Berdukacita','hati','maria'),(r'Marta, Santa Maria','rumah','putih'),(r'Hamba-hamba Maria','rosario','putih'),(r'Mengunjungi Elisabet','mawar','maria'),
(r'Petrus dan Santo Paulus','kunci','merah'),(r'Tomas, Rasul','tangan','merah'),(r'Andreas, Rasul','ikan','merah'),(r'Simon dan Santo Yudas','perahu','merah'),(r'Yohanes, Rasul','pena','merah'),
(r'Fransiskus dari Asisi','merpati','putih'),(r'Raymundus','jubah','putih'),(r'Hieronimus Emiliani','tangan','putih'),(r'Sirilus, Biarawan','buku','putih'),(r'Kasimirus','lili','putih'),
(r'Yohanes dari Allah','hati','putih'),(r'Fransiska dari Roma','sayap','putih'),(r'Fransiskus dari Paola','tongkatgembala','putih'),(r'Vinsensius Ferrer','api','putih'),(r'de La Salle','buku','putih'),
(r'Montfort','rosario','putih'),(r'Bernardinus','matahari','putih'),(r'Aloysius','lili','putih'),(r'Martir Pertama','palma','merah'),(r'Henrikus','mahkota','putih'),(r'Sarbel','kandil','putih'),
(r'Eymard','piala','putih'),(r'Kayetanus','roti','putih'),(r'de Chantal','hati','putih'),(r'Stefanus dari Hungaria','mahkota','putih'),(r'Yohanes Eudes','hati','putih'),(r'Ludovikus','mahkota','putih'),
(r'Petrus Klaver','tangan','putih'),(r'Bruno','bintang','putih'),(r'Leonardi','dunia','putih'),(r'Hedwig','mahkota','putih'),(r'Paulus dari Salib','salib','putih'),(r'Capestrano','salib','putih'),
(r'Martinus de Porres','roti','putih'),(r'Margareta dari Skotlandia','mahkota','putih'),(r'Cuauhtlatoatzin','mawar','maria'),(r'Yohanes dari Kanty','roti','putih'),
(r'Rosario','rosario','maria'),(r'Hati (Tersuci|Tak Bernoda) (Santa Perawan )?Maria|Hati Maria','hati','maria'),(r'Kabar Sukacita','lili','maria'),
(r'Diangkat ke Surga|Bunda Allah','bintang','maria'),(r'Dikandung Tanpa Noda|Lourdes|Fatima|Guadalupe','mawar','maria'),(r'Maria Magdalena de Pazzi','lili','putih'),(r'Maria Magdalena','piala','putih'),(r'Maria Goretti','palma','merah'),(r'Margareta Maria','hati','putih'),(r'Perawan Maria|Bunda Maria|Nama (Tersuci )?Maria|Maria Ratu|Ratu Surga','mawar','maria'),
(r'Malaikat','sayap','putih'),(r'Takhta Santo Petrus|Petrus dan Paulus|Santo Petrus$','kunci','merah'),(r'Bertobatnya Santo Paulus|Paulus Rasul','pedang','merah'),
(r'Andreas Rasul|^Santo Andreas$','ikan','merah'),(r'Yakobus Rasul|Yakobus,','kerang','merah'),(r'Yohanes Pembaptis|Kelahiran Santo Yohanes','domba','merah'),(r'Yohanes Rasul','pena','merah'),
(r'Markus','singa','merah'),(r'Lukas','pena','merah'),(r'Matius','koin','merah'),(r'Tomas Rasul|Santo Tomas$','tangan','merah'),(r'Bartolomeus','pedang','merah'),
(r'Filipus dan Yakobus','salib','merah'),(r'Simon dan Yudas','perahu','merah'),(r'Matias','salib','merah'),(r'Barnabas','buku','merah'),
(r'Katarina dari Aleksandria','roda','merah'),(r'Laurensius(?! Ruiz)','panggangan','merah'),(r'Sebastianus','panah','merah'),(r'Agnes','domba','merah'),
(r'Lusia','mata','merah'),(r'Sesilia','kecapi','merah'),(r'Stefanus(?! dari Hungaria)','batu','merah'),(r'Kanak-kanak Suci','palma','merah'),
(r'Yosef','lili','putih'),(r'Martinus dari Tours','jubah','putih'),(r'Fransiskus Xaverius','dunia','putih'),(r'Fransiskus dari Assisi|Fransiskus Asisi','merpati','putih'),
(r'Teresia dari Kanak|Teresia Lisieux','mawar','putih'),(r'Dominikus','rosario','putih'),(r'Thomas Aquinas|Tomas Aquinas','matahari','putih'),(r'Agustinus(?! dari Canterbury)(?! Zhao)','hati','putih'),
(r'Ignatius dari Loyola','api','putih'),(r'Benediktus','piala','putih'),(r'Skolastika','merpati','putih'),(r'Nikolaus','koin','putih'),(r'Klara','matahari','putih'),
(r'Antonius dari Padua','lili','putih'),(r'Antonius, Abas|Antonius Abas','kandil','putih'),(r'Patrisius','tunas','putih'),(r'Hati (Yesus )?Mahakudus|Hati Kudus','hati','putih'),
(r'Kristus Raja','mahkota','putih'),(r'Tubuh dan Darah','piala','putih'),(r'Salib Suci','salib','merah'),(r'Penampakan Tuhan','bintang','putih'),(r'Pembaptisan Tuhan','air','putih'),
(r'Yesus Dipersembahkan|Persembahan Tuhan','kandil','putih'),(r'Yesus Menampakkan Kemuliaan|Transfigurasi','matahari','putih'),(r'Semua Orang Kudus','mahkota','putih'),
(r'Arwah','kandil','ungu'),(r'Basilika|Gereja Lateran|Pemberkatan','gereja','putih'),(r'Keluarga Kudus','rumah','putih'),(r'Elisabet','roti','putih'),(r'Yoakim','tunas','putih'),
(r'Teresa dari Avila|Teresia dari Avila|Teresia dari Yesus','api','putih'),(r'Vinsensius a Paulo','tangan','putih'),(r'Kamilus','salib','putih'),(r'Monika','air','putih'),
(r'Maksimilianus Kolbe','palma','merah'),(r'Hieronimus(?! Emiliani)','buku','putih'),(r'Gregorius Agung|Gregorius I\b','merpati','putih'),(r'Ambrosius','tongkat','putih'),
(r'Yohanes dari Salib','tangga','putih'),(r'Pio\b|Padre Pio','salib','putih'),(r'Rita','mawar','putih'),(r'Filipus Neri','api','putih'),(r'Karolus Borromeus','tongkat','putih'),
(r'Yohanes Maria Vianney','kandil','putih'),(r'Yohanes Bosco','tangan','putih'),(r'Margareta Maria','hati','putih'),(r'Brigita','pena','putih'),(r'Benediktus|Bernardus','buku','putih'),
(r'Pemenggalan|Wafatnya Santo Yohanes','domba','merah')]
GL=[(r'Martir','palma','merah'),(r'Paus','kunci','putih'),(r'Uskup','tongkat','putih'),(r'Pujangga','buku','putih'),(r'Perawan','lili','putih'),(r'Raja|Ratu','mahkota','putih'),(r'Misionaris','dunia','putih'),(r'Abas','buku','putih')]
fb=[]
for x in S:
    r=first(x['nama'],[(p,(a,b)) for p,a,b in SN]) or first(x.get('gelar',''),[(p,(a,b)) for p,a,b in GL])
    if not r: r=('salib','putih'); fb.append(x['nama']+' | '+x.get('gelar',''))
    x['lambang'],x['warna']=r
PR={'Penabur':'tunas','Gandum':'gandum','Sesawi':'tunas','Ragi':'roti','Harta':'koin','Mutiara':'mutiara','Pukat':'jala','Benih':'tunas','Domba yang Hilang':'domba','Dirham':'koin','Anak yang Hilang':'rumah',
'Hamba yang Tidak':'timbangan','Pekerja':'anggur','Dua Anak':'anggur','Penggarap':'anggur','Perjamuan':'piala','Gadis':'pelita','Talenta':'koin','Mina':'koin','Domba dan Kambing':'domba','Samaria':'tangan',
'Orang Kaya yang Bodoh':'gandum','Bendahara':'koin','Lazarus':'pintu','Hakim':'timbangan','Farisi':'tangan','Pohon Ara':'pohon','Sahabat':'roti','Rumah':'rumah','Menara':'batu','Raja':'mahkota',
'Pelita':'pelita','Garam':'air','Anggur Baru':'anggur','Kain':'jubah','Gembala':'tongkatgembala','Pokok Anggur':'anggur','Pintu':'pintu','Hamba yang Berjaga':'pelita','Pencuri':'pintu','Tamu':'piala','Tuan':'koin','Pengutang':'koin','Dua Orang Anak':'anggur','Berutang':'koin'}
fbp=[]
for x in P:
    v=next((s for k,s in PR.items() if k.lower() in x['judul'].lower()),None)
    if not v: v='tunas'; fbp.append(x['judul'])
    x['lambang'],x['warna']=v,'hijau'
TK={'Adam':'pohon','Nuh':'bahtera','Abraham':'bintang','Sara':'tunas','Ishak':'domba','Ribka':'air','Yakub':'tangga','Yusuf':'jubah','Musa':'loh','Harun':'kandil','Miryam':'air','Yosua':'batu',
'Debora':'pohon','Gideon':'kandil','Rut':'gandum','Hana':'kandil','Samuel':'tanduk','Daud':'kecapi','Salomo':'mahkota','Elia':'api','Elisa':'jubah','Yesaya':'api','Yeremia':'pena','Yehezkiel':'mata',
'Daniel':'singa','Ester':'mahkota','Ayub':'tangan','Yunus':'paus','Nehemia':'batu','Ezra':'buku','Hosea':'hati','Maria':'mawar','Yusuf Suami':'lili','Yohanes Pembaptis':'domba','Petrus':'kunci','Andreas':'ikan',
'Yohanes':'pena','Yakobus':'kerang','Tomas':'tangan','Matius':'koin','Maria Magdalena':'piala','Marta':'roti','Zakheus':'pohon','Nikodemus':'kandil','Stefanus':'batu','Paulus':'pedang','Barnabas':'buku',
'Timotius':'buku','Lidia':'jubah','Priskila':'rumah','Rahab':'rumah','Yusuf, Suami':'lili','Marta dan Maria':'rumah'}
fbt=[]
for x in T:
    keys=sorted([k for k in TK if x['nama'].startswith(k) or k in x['nama']],key=len,reverse=True)
    v=TK[keys[0]] if keys else None
    if v=='tanduk': v='kandil'
    if not v: v='salib'; fbt.append(x['nama'])
    x['lambang'],x['warna']=v,('pl' if x['pl'] else 'pb')
c=collections.Counter(x['lambang'] for x in S+P+T)
print('fallback santo:',len(fb)); [print('  ',f) for f in fb]
print('fallback perumpamaan:',fbp); print('fallback tokoh:',fbt)
print(c.most_common())
import sys
if 'tulis' in sys.argv:
    for n,a in [('santo',S),('perumpamaan',P),('tokoh',T)]: json.dump(a,open(D+n+'.json','w'),ensure_ascii=False,separators=(',',':'))
    print('ditulis')
