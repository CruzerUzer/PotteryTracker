import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Star,
  Plus,
  MapPin,
  Layers,
  ImagePlus,
  Package,
  ChevronDown,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI, imagesAPI, studyAPI } from '../services/api';
import ImageUpload from './ImageUpload';
import ImageLightbox from './ImageLightbox';
import MaterialPicker, { MATERIAL_TYPE_LABELS } from './MaterialPicker';
import MoveSheet from './kanban/MoveSheet';
import { phaseColor } from './kanban/phaseColors';
import { Sheet, SheetContent } from './ui/sheet';
import { useToast } from './ui/toast';
import { useConfirm } from './ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { usePieceMover } from '../hooks/usePieceMover';
import Logo from './Logo';

const byOrder = (a, b) => (a.display_order || 0) - (b.display_order || 0);

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
};

function PieceDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const goBack = useBackNavigation('/');
  const { studyEnabled } = useAuth();
  const [studySessions, setStudySessions] = useState([]);

  const [piece, setPiece] = useState(null);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [moveFocus, setMoveFocus] = useState(null); // 'phase' | 'location' | null
  const [uploadOpen, setUploadOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [editing, setEditing] = useState(null); // 'name' | 'description' | null
  const [editValue, setEditValue] = useState('');
  const [editMaterials, setEditMaterials] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        if (!quiet) setLoading(true);
        setError(null);
        const [pieceData, phasesData, locationsData, materialsData] = await Promise.all([
          piecesAPI.getById(id),
          phasesAPI.getAll(),
          locationsAPI.getAll(),
          materialsAPI.getAll(),
        ]);
        setPiece(pieceData);
        setPhases([...phasesData].sort(byOrder));
        setLocations([...locationsData].sort(byOrder));
        setMaterials(materialsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Studie: de pass alstret varit med i (bara när Studie är på)
  useEffect(() => {
    if (!studyEnabled) return undefined;
    let cancelled = false;
    studyAPI
      .getPieceSessions(id)
      .then((rows) => !cancelled && setStudySessions(rows))
      .catch(() => !cancelled && setStudySessions([]));
    return () => {
      cancelled = true;
    };
  }, [id, studyEnabled]);

  // Nyss skapad pjäs: öppna bilduppladdningen direkt
  useEffect(() => {
    if (location.state?.justCreated) {
      setUploadOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const onPatch = useCallback((_, patch) => setPiece((p) => (p ? { ...p, ...patch } : p)), []);
  const movePiece = usePieceMover({ phases, locations, onPatch });

  /** PUT kräver hela pjäsen, annars nollställs utelämnade fält. */
  const savePiece = async (changes, successMessage) => {
    setSaving(true);
    try {
      await piecesAPI.update(id, {
        name: piece.name,
        description: piece.description || '',
        current_phase_id: piece.current_phase_id || null,
        current_location_id: piece.current_location_id || null,
        ...changes,
      });
      await loadData({ quiet: true });
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error('Kunde inte spara', err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (field) => {
    setEditValue(field === 'name' ? piece.name || '' : piece.description || '');
    setEditing(field);
  };

  const saveEditing = async () => {
    if (saving) return;
    const value = editValue.trim();
    if (editing === 'name' && !value) {
      toast.error('Pjäsen behöver ett namn');
      return;
    }
    const ok = await savePiece(editing === 'name' ? { name: value } : { description: value });
    if (ok) setEditing(null);
  };

  const saveMaterials = async () => {
    const ok = await savePiece({ material_ids: editMaterials }, 'Materialen är sparade');
    if (ok) setMaterialsOpen(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Ta bort pjäsen?',
      description: `”${piece.name}” och alla dess bilder raderas och kan inte återskapas.`,
      confirmLabel: 'Ta bort',
      destructive: true,
    });
    if (!ok) return;
    try {
      await piecesAPI.delete(id);
      toast.success('Pjäsen är borttagen');
      goBack();
    } catch (err) {
      toast.error('Kunde inte ta bort pjäsen', err.message);
    }
  };

  const deleteImage = async (imageId) => {
    try {
      await imagesAPI.delete(imageId);
      await loadData({ quiet: true });
      return true;
    } catch (err) {
      toast.error('Kunde inte ta bort bilden', err.message);
      return false;
    }
  };

  const confirmDeleteImage = async (imageId) => {
    const ok = await confirm({
      title: 'Ta bort bilden?',
      description: 'Bilden raderas permanent.',
      confirmLabel: 'Ta bort',
      destructive: true,
    });
    if (ok) deleteImage(imageId);
  };

  const toggleCover = async (imageId) => {
    try {
      const next = piece.default_image_id === imageId ? null : imageId;
      await piecesAPI.setDefaultImage(id, next);
      setPiece((p) => ({ ...p, default_image_id: next }));
      toast.success(next ? 'Ny omslagsbild' : 'Omslagsbilden är borttagen');
    } catch (err) {
      toast.error('Kunde inte välja omslagsbild', err.message);
    }
  };

  if (loading) {
    return (
      <div className="detail" aria-busy="true">
        <div className="skeleton h-9 w-24 mb-4" />
        <div className="detail-layout">
          <div className="skeleton detail-hero-skeleton" />
          <div className="space-y-3">
            <div className="skeleton h-10 w-3/4" />
            <div className="skeleton h-8 w-1/2" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !piece) {
    return (
      <div className="detail">
        <div className="error" role="alert">
          {error || 'Pjäsen hittades inte'}
        </div>
        <button type="button" className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Tillbaka
        </button>
      </div>
    );
  }

  const images = piece.images || [];
  const coverId = piece.default_image_id || images[0]?.id;
  const coverIndex = Math.max(0, images.findIndex((img) => img.id === coverId));
  const cover = images[coverIndex];
  const phaseIdx = phases.findIndex((p) => p.id === piece.current_phase_id);
  const pc = phaseIdx >= 0 ? phaseColor(phaseIdx) : null;
  const created = formatDate(piece.created_at);
  const updated = formatDate(piece.updated_at);

  return (
    <div className="detail">
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Tillbaka">
          <ArrowLeft size={19} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="icon-btn" aria-label="Fler val">
              <MoreHorizontal size={19} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onClick={() => startEditing('name')} className="gap-2">
              <Pencil size={15} /> Byt namn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUploadOpen(true)} className="gap-2">
              <ImagePlus size={15} /> Lägg till bilder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="gap-2 text-[var(--color-error)]">
              <Trash2 size={15} /> Ta bort pjäsen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="detail-layout">
        <div className="detail-media">
          {cover ? (
            <button
              type="button"
              className="detail-hero"
              onClick={() => setLightboxIndex(coverIndex)}
              aria-label="Visa bilden i helskärm"
            >
              <img src={imagesAPI.getFileUrl(cover.id)} alt={piece.name} />
              {images.length > 1 && <span className="detail-hero-count">{images.length} bilder</span>}
            </button>
          ) : (
            <button type="button" className="detail-hero detail-hero--empty" onClick={() => setUploadOpen(true)}>
              <span className="detail-hero-empty-mark" style={pc ? { color: pc.accent } : undefined}>
                <Logo size={36} color="currentColor" />
              </span>
              <span className="detail-hero-empty-title">Lägg till första bilden</span>
              <span className="detail-hero-empty-text">Ett foto per fas gör det lätt att följa pjäsens resa.</span>
            </button>
          )}

          {images.length > 0 && (
            <div className="image-strip" role="list" aria-label="Bilder">
              {images.map((image, index) => {
                const isCover = piece.default_image_id === image.id;
                return (
                  <div key={image.id} className={`strip-item${index === coverIndex ? ' strip-item--current' : ''}`} role="listitem">
                    <button
                      type="button"
                      className="strip-thumb"
                      onClick={() => setLightboxIndex(index)}
                      aria-label={`Bild ${index + 1}${image.phase_name ? `, ${image.phase_name}` : ''}`}
                    >
                      <img src={imagesAPI.getFileUrl(image.id, true)} alt="" loading="lazy" />
                      {image.phase_name && <span className="strip-phase">{image.phase_name}</span>}
                    </button>
                    <button
                      type="button"
                      className={`strip-star${isCover ? ' strip-star--on' : ''}`}
                      onClick={() => toggleCover(image.id)}
                      aria-pressed={isCover}
                      aria-label={isCover ? 'Ta bort som omslagsbild' : 'Använd som omslagsbild'}
                      title={isCover ? 'Omslagsbild' : 'Använd som omslagsbild'}
                    >
                      <Star size={13} className={isCover ? 'fill-current' : ''} />
                    </button>
                    <button
                      type="button"
                      className="strip-delete"
                      onClick={() => confirmDeleteImage(image.id)}
                      aria-label="Ta bort bilden"
                      title="Ta bort bilden"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
              <button type="button" className="strip-add" onClick={() => setUploadOpen(true)} aria-label="Lägg till bilder">
                <Plus size={22} />
              </button>
            </div>
          )}
        </div>

        <div className="detail-info">
          {editing === 'name' ? (
            <div className="inline-edit">
              <input
                className="field-input field-input--title"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') setEditing(null);
                }}
                aria-label="Namn"
                autoFocus
                disabled={saving}
              />
              <button type="button" className="icon-btn icon-btn--primary" onClick={saveEditing} disabled={saving} aria-label="Spara namn">
                <Check size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)} disabled={saving} aria-label="Avbryt">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="detail-title-row">
              <h1 className="detail-title">{piece.name}</h1>
              <button type="button" className="icon-btn icon-btn--ghost" onClick={() => startEditing('name')} aria-label="Byt namn">
                <Pencil size={16} />
              </button>
            </div>
          )}

          <div className="detail-chips">
            <button
              type="button"
              className="chip chip--phase chip--lg"
              style={pc ? { '--chip-bg': pc.bg, '--chip-border': pc.border, '--chip-accent': pc.accent } : undefined}
              onClick={() => setMoveFocus('phase')}
              aria-label={`Fas: ${piece.phase_name || 'ingen'}. Byt fas`}
            >
              <Layers size={14} aria-hidden="true" />
              {piece.phase_name || 'Ingen fas'}
              <ChevronDown size={14} aria-hidden="true" className="opacity-60" />
            </button>
            <button
              type="button"
              className="chip chip--lg"
              onClick={() => setMoveFocus('location')}
              aria-label={`Plats: ${piece.location_name || 'ingen'}. Byt plats`}
            >
              <MapPin size={14} aria-hidden="true" />
              {piece.location_name || 'Ingen plats'}
              <ChevronDown size={14} aria-hidden="true" className="opacity-60" />
            </button>
            {piece.done === 1 && <span className="done-chip done-chip--lg">Färdig</span>}
          </div>

          <section className="detail-section">
            <div className="detail-section-head">
              <h2>Beskrivning</h2>
              {editing !== 'description' && (
                <button type="button" className="icon-btn icon-btn--ghost" onClick={() => startEditing('description')} aria-label="Redigera beskrivning">
                  <Pencil size={15} />
                </button>
              )}
            </div>
            {editing === 'description' ? (
              <div className="space-y-2">
                <textarea
                  className="field-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={5}
                  disabled={saving}
                  aria-label="Beskrivning"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={saveEditing} disabled={saving}>
                    <Check size={15} /> {saving ? 'Sparar…' : 'Spara'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={saving}>
                    Avbryt
                  </button>
                </div>
              </div>
            ) : piece.description ? (
              <p className="detail-description">{piece.description}</p>
            ) : (
              <button type="button" className="detail-placeholder" onClick={() => startEditing('description')}>
                Ingen beskrivning ännu. Tryck för att skriva en.
              </button>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-head">
              <h2>Material</h2>
              <button
                type="button"
                className="icon-btn icon-btn--ghost"
                onClick={() => {
                  setEditMaterials(piece.materials?.map((m) => m.id) || []);
                  setMaterialsOpen(true);
                }}
                aria-label="Redigera material"
              >
                <Pencil size={15} />
              </button>
            </div>
            {piece.materials?.length ? (
              <div className="chip-row">
                {piece.materials.map((m) => (
                  <span key={m.id} className="chip chip--static">
                    <Package size={13} aria-hidden="true" />
                    {m.name}
                    <span className="chip-note">{MATERIAL_TYPE_LABELS[m.type] || m.type}</span>
                  </span>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="detail-placeholder"
                onClick={() => {
                  setEditMaterials([]);
                  setMaterialsOpen(true);
                }}
              >
                Inga material angivna. Tryck för att lägga till.
              </button>
            )}
          </section>

          {studySessions.length > 0 && (
            <section className="detail-section">
              <div className="detail-section-head">
                <h2>Pass</h2>
                <GraduationCap size={15} aria-hidden="true" className="opacity-60" />
              </div>
              <p className="detail-study-row">
                {studySessions.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <Link to={`/studie/pass/${s.session_id}`} className="detail-study-link">
                      {s.action_label} {s.is_free ? 'fritt pass' : s.week_number ? `pass ${s.week_number}` : 'pass'}
                    </Link>
                  </React.Fragment>
                ))}
              </p>
            </section>
          )}

          {(created || updated) && (
            <p className="detail-meta">
              {created && <>Skapad {created}</>}
              {created && updated && updated !== created && ' · '}
              {updated && updated !== created && <>Ändrad {updated}</>}
            </p>
          )}
        </div>
      </div>

      <MoveSheet
        open={!!moveFocus}
        onOpenChange={(open) => !open && setMoveFocus(null)}
        piece={{ ...piece, display_image_id: cover?.id, image_count: images.length, material_count: piece.materials?.length }}
        phases={phases}
        locations={locations}
        onMove={movePiece}
        showOpenLink={false}
        focus={moveFocus || 'phase'}
      />

      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent title="Lägg till bilder" description={piece.name}>
          <ImageUpload
            pieceId={id}
            phases={phases}
            defaultPhaseId={piece.current_phase_id || null}
            onUploaded={async ({ successCount = 1, errorCount = 0 } = {}) => {
              await loadData({ quiet: true });
              if (errorCount > 0) {
                toast.error(`${errorCount} ${errorCount === 1 ? 'bild' : 'bilder'} kunde inte laddas upp`, 'Försök igen med dem.');
                return; // arket står kvar så att användaren ser vilka som misslyckades
              }
              setUploadOpen(false);
              toast.success(successCount === 1 ? 'Bilden är uppladdad' : `${successCount} bilder uppladdade`);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={materialsOpen} onOpenChange={setMaterialsOpen}>
        <SheetContent
          title="Material"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setMaterialsOpen(false)} disabled={saving}>
                Avbryt
              </button>
              <button type="button" className="btn btn-primary" onClick={saveMaterials} disabled={saving}>
                {saving ? 'Sparar…' : 'Spara'}
              </button>
            </>
          }
        >
          <MaterialPicker materials={materials} value={editMaterials} onChange={setEditMaterials} disabled={saving} />
        </SheetContent>
      </Sheet>

      {lightboxIndex !== null && images.length > 0 && (
        <ImageLightbox
          images={images}
          currentIndex={Math.min(lightboxIndex, images.length - 1)}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          pieceName={piece.name}
          onDelete={async (imageId) => {
            const ok = await deleteImage(imageId);
            if (!ok) return;
            if (images.length === 1) setLightboxIndex(null);
            else if (lightboxIndex >= images.length - 1) setLightboxIndex(images.length - 2);
          }}
        />
      )}
    </div>
  );
}

export default PieceDetail;
