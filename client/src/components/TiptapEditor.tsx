import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, List, ListOrdered, Heading2, Quote, Undo, Redo, Image as ImageIcon, Link2, Unlink, Loader2
} from 'lucide-react'
import api from '../lib/api'

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  uploadUrl?: string
  minHeight?: string
  minimal?: boolean
}

export default function TiptapEditor({ content, onChange, placeholder, uploadUrl, minHeight, minimal }: Props) {
  const skipNextContent = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2] }, link: false }),
      Placeholder.configure({ placeholder: placeholder || 'اكتب هنا...' }),
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      skipNextContent.current = true
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: { class: `prose prose-sm max-w-none focus:outline-none ${minHeight || 'min-h-[120px]'} px-3 py-2 text-sm text-gray-800` }
    }
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      if (skipNextContent.current) {
        skipNextContent.current = false
        return
      }
      editor.commands.setContent(content)
    }
  }, [content, editor])

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor || !uploadUrl) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      const urlParts = new URL(uploadUrl, window.location.origin)
      const entityType = urlParts.searchParams.get('entity_type') || 'subtask'
      const entityId = urlParts.searchParams.get('entity_id') || '0'
      formData.append('entity_type', entityType)
      formData.append('entity_id', entityId)
      const { data } = await api.post('/uploads', formData)
      if (data?.[0]?.filename) {
        editor.chain().focus().setImage({ src: `/uploads/${data[0].filename}` }).run()
      }
    } catch (e) {
      console.error('Image upload failed', e)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const setLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('الرابط:', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url }).run()
  }

  if (!editor) return null

  const btn = (label: string, active: boolean, onClick: () => void) => (
    <button type="button" onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
      title={label}>
      {label === 'Bold' ? <Bold className="w-4 h-4" /> :
       label === 'Italic' ? <Italic className="w-4 h-4" /> :
       label === 'BulletList' ? <List className="w-4 h-4" /> :
       label === 'OrderedList' ? <ListOrdered className="w-4 h-4" /> :
       label === 'Heading' ? <Heading2 className="w-4 h-4" /> :
       label === 'Blockquote' ? <Quote className="w-4 h-4" /> :
       label === 'Undo' ? <Undo className="w-4 h-4" /> :
       <Redo className="w-4 h-4" />}
    </button>
  )

  return (
    <div className={`${minimal ? 'border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent' : 'border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent'}`}>
      {!minimal && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
          {btn('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
          {btn('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          {btn('Heading', editor.isActive('heading'), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          {btn('BulletList', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
          {btn('OrderedList', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
          {btn('Blockquote', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || !uploadUrl}
            className={`p-1.5 rounded transition-colors ${uploading ? 'text-gray-400' : 'text-gray-500 hover:bg-gray-100'}`}
            title="إدراج صورة">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button type="button" onClick={setLink}
            className={`p-1.5 rounded transition-colors ${editor.isActive('link') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="إدراج رابط">
            <Link2 className="w-4 h-4" />
          </button>
          {editor.isActive('link') && (
            <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100" title="إزالة الرابط">
              <Unlink className="w-4 h-4" />
            </button>
          )}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          {btn('Undo', false, () => editor.chain().focus().undo().run())}
          {btn('Redo', false, () => editor.chain().focus().redo().run())}
        </div>
      )}
      <div className="relative">
        <EditorContent editor={editor} />
        {minimal && uploadUrl && (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="absolute left-2 bottom-2 p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="إدراج صورة">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </>
        )}
      </div>
    </div>
  )
}
