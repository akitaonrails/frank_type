class PagesController < ApplicationController
  def home
  end

  def profile
  end

  def sources
    @excerpts = Typing::ExcerptCatalog.all
  end
end
