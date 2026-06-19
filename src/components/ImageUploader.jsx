// ============================================================================
//  رفع الصور المتعددة — جسور جلوبال  (المرحلة ٣)
//  يرفع إلى Supabase Storage ويربط بالفندق/الجولة، مع تعيين غلاف وحذف.
// ============================================================================
import React, { useState, useRef, useEffect } from "react";
import { Upload, Star, Trash2, ImagePlus } from "lucide-react";
import { uploadMedia } from "../lib/supabase.js";
import { db } from "../lib/data.js";
import { useI18n } from "../lib/i18n.jsx";

export function ImageUploader({ ownerType, ownerId, onChange, canEdit }) {
  const { t } = useI18n();
  const [media, setMedia] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  // يحمّل صوره بنفسه (الصور مرتبطة بنوع+رقم، لا تُدمج في استعلام الفندق)
  useEffect(() => {
    if (!ownerId) return;
    db.media.byOwner(ownerType, ownerId).then(({ data }) => setMedia(data || []));
  }, [ownerType, ownerId]);

  const pickFiles = () => fileRef.current?.click();

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of files) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > 5 * 1024 * 1024) continue; // حد ٥ ميجابايت
        const row = await uploadMedia(f, ownerType, ownerId);
        added.push(row);
      }
      setMedia((m) => [...m, ...added]);
      onChange?.();
    } catch (err) {
      console.error("upload failed", err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setCover = async (id) => {
    await db.media.setCover(ownerType, ownerId, id);
    setMedia((m) => m.map((x) => ({ ...x, is_cover: x.id === id })));
  };

  const remove = async (id) => {
    await db.media.remove(id);
    setMedia((m) => m.filter((x) => x.id !== id));
    onChange?.();
  };

  return (
    <div className="uploader">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      {media.length === 0 && !canEdit && <div className="up-empty">{t("no_images")}</div>}
      <div className="uploader-grid">
        {media
          .slice()
          .sort((a, b) => (b.is_cover ? 1 : 0) - (a.is_cover ? 1 : 0))
          .map((m) => (
            <div className="up-thumb" key={m.id}>
              <img src={m.public_url} alt="" />
              {m.is_cover && (
                <span className="up-cover-badge"><Star size={10} /> {t("cover")}</span>
              )}
              {canEdit && (
                <div className="up-thumb-actions">
                  <button title={t("set_cover")} onClick={() => setCover(m.id)}><Star size={15} /></button>
                  <button className="del" title={t("delete")} onClick={() => remove(m.id)}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        {canEdit && (
          <button className="up-drop" onClick={pickFiles} disabled={busy}>
            {busy ? <Upload size={20} /> : <ImagePlus size={20} />}
            <span>{busy ? t("loading") : t("upload_img")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
